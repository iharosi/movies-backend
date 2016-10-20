/* eslint camelcase: ["error", {properties: "never"}] */

const co = require('co');
const path = require('path');
const chokidar = require('chokidar');
const Bottleneck = require('bottleneck');
const color = require('./lib/colors');
const config = require('./config');
const TMDbClient = require('./lib/tmdbclient');
const TMDbAuth = require('./lib/tmdbauth');
const Cacher = require('./lib/cacher');
const Store = require('./lib/store');
let tmdb = new TMDbClient(config.tmdb.key);
let tmdba = new TMDbAuth(config.tmdb.key);
let limiter = new Bottleneck(0, 500);
let session = new Cacher(path.join(__dirname, config.cache.session));
let database = new Cacher(path.join(__dirname, config.cache.database));

co(function* init() {
    let db = new Store(database);
    let dbcache = yield database.getData();
    if (dbcache) {
        db.loadDatabase(dbcache);
    }

    let sessionId;
    let account;
    sessionId = yield session.getData();
    if (!sessionId) {
        sessionId = yield tmdba.getAuthenticated();
        session.setData(sessionId);
    }
    account = yield tmdb.call('/account', {
        session_id: sessionId
    });
    if (!account.id) {
        sessionId = yield tmdba.getAuthenticated();
        session.setData(sessionId);
        account = yield tmdb.call('/account', {
            session_id: sessionId
        });
    }
    for (let i = 0; i < config.tmdb.lists.length; i += 1) {
        let list = config.tmdb.lists[i];
        let dir = list.folder;
        if (!path.isAbsolute(dir)) {
            dir = path.join(__dirname, list.folder);
        }

        cleanUpDatabase(db, list.id);

        let watcher = chokidar.watch(dir, {
            persistent: true,
            ignored: /[\/\\]\./,
            ignoreInitial: false,
            followSymlinks: false,
            cwd: dir,
            depth: 0
        });

        watcher
            .on('addDir', (folder) => {
                if (folder) {
                    console.log(`+ ${color.fgGreen}${folder}${color.reset}`);
                    addMovie(db, folder, list.id, sessionId);
                }
            })
            .on('unlinkDir', (folder) => {
                if (folder) {
                    console.log(`- ${color.fgMagenta}${folder}${color.reset}`);
                    removeMovie(db, folder, list.id, sessionId);
                }
            })
            .on('error', (error) => {
                console.log(`${color.fgRed}Error${color.reset}`, error);
            })
            .on('ready', () => {
                console.log(`${color.dim}Initial scan complete. ` +
                    `Ready for changes.${color.reset}`);
                syncTMDbList(db, list.id, sessionId);
            });
    }
}).catch((error) => {
    console.log('Error', error);
    process.exit(0);
});

/**
 * @param {Object} db Store instance
 * @param {Number} listID TMDb list ID
 */
function cleanUpDatabase(db, listID) {
    db.getAll(listID)
        .filter((record) => {
            return !record.metadata;
        })
        .forEach((record) => {
            db.delete(listID, record.id);
        });
}

/**
 * @param {Object} db Store instance
 * @param {Number} listID TMDb list ID
 * @param {Number} sessionID TMDb Session ID
 */
function syncTMDbList(db, listID, sessionID) {
    getMoviesOfList(listID)
        .then((list) => {
            return list.items.map((item) => {
                return item.id;
            });
        })
        .then((listMovieIDs) => {
            let movieIDs = db.getAll(listID)
                .filter((item) => {
                    let include = false;
                    if (item.metadata && item.metadata.id) {
                        include = true;
                    }
                    return include;
                })
                .map((item) => {
                    return item.metadata.id;
                });
            return {
                local: movieIDs,
                remote: listMovieIDs
            };
        })
        .then((movies) => {
            let remove = movies.remote.filter((remoteItem) => {
                return !movies.local.find((localItem) => {
                    return remoteItem === localItem;
                });
            }).map((movieID) => {
                return removeMovieFromList(movieID, listID, sessionID);
            });
            let add = movies.local.filter((localItem) => {
                return !movies.remote.find((remoteItem) => {
                    return localItem === remoteItem;
                });
            }).map((movieID) => {
                return addMovieToList(movieID, listID, sessionID);
            });
            return remove.concat(add);
        })
        .catch((error) => {
            console.log('Error', error);
        });
}

/**
 * @param {Object} db Store instance
 * @param {String} folder Folder name
 * @param {Number} listID TMBb list ID
 * @param {Number} sessionID Session ID
 */
function addMovie(db, folder, listID, sessionID) {
    let movie = extractDataFromFolderName(folder);
    if (movie && movie.id && movie.title && movie.year) {
        let addedMovie = db.insert(listID, movie);
        if (addedMovie && !addedMovie.metadata) {
            findMovieMetadata(movie)
                .then((response) => {
                    if (response.total_results > 0) {
                        let result = response.results[0];
                        db.update(listID, movie.id, {
                            metadata: result
                        });
                        addMovieToList(result.id, listID, sessionID)
                            .then((result) => {
                                if (result && result.status_code !== 8) {
                                    console.log(
                                        `\x1b[33m${result.status_message} ` +
                                        `(${result.status_code})\x1b[0m`
                                    );
                                }
                            })
                            .catch((e) => {
                                console.log(e);
                            });
                    } else {
                        console.log(
                            `${color.fgRed}Couldn't locate movie in TMDb:`,
                            `${movie.title} (${movie.year}) – ` +
                            `${movie.id}${color.reset}`
                        );
                    }
                })
                .catch((err) => {
                    console.log(err);
                });
        }
    } else {
        console.log(
            `\x1b[31mMovie title could not extract from: \x1b[0m`,
            folder
        );
    }
}

/**
 * @param {Object} db Store instance
 * @param {String} folder Folder name
 * @param {Number} listID TMBb list ID
 * @param {Number} sessionID Session ID
 */
function removeMovie(db, folder, listID, sessionID) {
    let movie = extractDataFromFolderName(folder);
    if (movie && movie.id && movie.title && movie.year) {
        let removedMovie = db.delete(listID, movie.id);
        if (removedMovie && removedMovie.metadata && removedMovie.metadata.id) {
            removeMovieFromList(removedMovie.metadata.id, listID, sessionID)
                .then((result) => {
                    if (result && result.status_code !== 8) {
                        console.log(
                            `\x1b[33m${result.status_message} ` +
                            `(${result.status_code})\x1b[0m`
                        );
                    }
                })
                .catch((e) => {
                    console.log(e);
                });
        }
    } else {
        console.log(
            `\x1b[31mMovie title could not extract from: \x1b[0m`,
            folder
        );
    }
}

/**
 * @param {Number} movieID The ID of the movie
 * @param {Number} listID The ID of the list
 * @param {Number} sessionID Session ID
 *
 * @return {Promise} API call response body
 */
function removeMovieFromList(movieID, listID, sessionID) {
    return limiter.schedule(
        tmdb.call.bind(
            tmdb,
            `/list/${listID}/remove_item`,
            {
                session_id: sessionID
            },
            'POST',
            {
                media_id: movieID
            }
        )
    );
}

/**
 * @param {Number} movieID The ID of the movie
 * @param {Number} listID The ID of the list
 * @param {Number} sessionID Session ID
 *
 * @return {Promise} API call response body
 */
function addMovieToList(movieID, listID, sessionID) {
    return limiter.schedule(
        tmdb.call.bind(
            tmdb,
            `/list/${listID}/add_item`,
            {
                session_id: sessionID
            },
            'POST',
            {
                media_id: movieID
            }
        )
    );
}

/**
 * @param {Number} listID TMDb list ID
 *
 * @return {Promise.<array>} Array of objects, containing movie metadatas
 */
function getMoviesOfList(listID) {
    return limiter.schedule(
        tmdb.call.bind(tmdb, `/list/${listID}`)
    );
}

/**
 * @param {Object} movie Extracted data from folder name
 *
 * @return {Promise} API call response body
 */
function findMovieMetadata(movie) {
    return limiter.schedule(
        tmdb.call.bind(
            tmdb,
            '/search/movie',
            {
                query: movie.title,
                year: movie.year
            }
        )
    );
}

/**
 * @param {String} folderName Folder name what contains movie title and year
 *
 * @return {Object} Movie data (title, year) and folder name
 */
function extractDataFromFolderName(folderName) {
    let matched = folderName.match(/^(.+?).(\d{4})/i);
    if (matched && matched.length >= 2) {
        return {
            id: folderName,
            title: matched[1].replace(/\./g, ' '),
            year: matched[2]
        };
    }
}
