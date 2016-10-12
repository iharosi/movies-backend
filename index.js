/* eslint camelcase: ["error", {properties: "never"}] */

const co = require('co');
const path = require('path');
const chokidar = require('chokidar');
const Bottleneck = require('bottleneck');
const TMDbClient = require('./lib/tmdbclient');
const TMDbAuth = require('./lib/tmdbauth');
const Cacher = require('./lib/cacher');

let limiter = new Bottleneck(0, 300);
let config = require('./config.js');
let tmdb = new TMDbClient(config.tmdb.key);
let tmdba = new TMDbAuth(config.tmdb.key);
let cache = new Cacher(path.join(__dirname, './session'));

co(function* init() {
    let sessionId;
    let account;
    sessionId = yield cache.getData();
    if (!sessionId) {
        sessionId = yield tmdba.getAuthenticated();
        cache.setData(sessionId);
    }
    account = yield tmdb.call('/account', {
        session_id: sessionId
    });
    if (!account.id) {
        sessionId = yield tmdba.getAuthenticated();
        cache.setData(sessionId);
        account = yield tmdb.call('/account', {
            session_id: sessionId
        });
    }
    for (let i = 0; i < config.tmdb.lists.length; i += 1) {
        let list = config.tmdb.lists[i];
        let dir = path.join(__dirname, list.folder);

        list.movies = yield tmdb.call(`/list/${list.id}`, {
            session_id: sessionId
        });

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
                    console.log(`+ \x1b[32m${folder}\x1b[0m`);
                    addMovie(folder, list, sessionId);
                }
            })
            .on('unlinkDir', (folder) => {
                if (folder) {
                    console.log(`- \x1b[35m${folder}\x1b[0m`);
                    removeMovie(folder, list, sessionId);
                }
            })
            .on('error', (error) => {
                console.log(`\x1b[31mError\x1b[0m`, error);
            })
            .on('ready', () => {
                console.log(`\x1b[2mInitial scan complete. ` +
                    `Ready for changes.\x1b[0m`);
            });
    }
}).catch((error) => {
    console.log('Error', error);
    process.exit(0);
});

/**
 * @param {String} folder Folder name
 * @param {Object} list List item from config
 * @param {Number} sessionID Session ID
 */
function removeMovie(folder, list, sessionID) {
    let movie = extractDataFromFolderName(folder);
    if (movie && movie.title && movie.year && movie.folder) {
        findMovieMetadata(movie)
            .then((metadata) => {
                let id = null;
                if (metadata.total_results > 0) {
                    id = metadata.results[0].id;
                } else {
                    console.log(`\x1b[31mCouldn't locate movie in TMDb:`,
                    `${movie.title} (${movie.year}) – ${movie.folder}\x1b[0m`);
                }
                return id;
            })
            // TODO: Introduce a Store where
            // remote and local movies can be maintained
            //
            // .then((movieID) => {
            //     let found = list.movies.items.find((item) => {
            //         return item.id === movieID;
            //     });
            //     return found ? movieID : null;
            // })
            .then((movieID) => {
                let result = null;
                if (movieID) {
                    result = removeMovieFromList(
                        movieID,
                        list.id,
                        sessionID
                    );
                }
                return result;
            })
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
            `\x1b[31mMovie title could not extract from: \x1b[0m`,
            folder
        );
    }
}

/**
 * @param {String} folder Folder name
 * @param {Object} list List item from config
 * @param {Number} sessionID Session ID
 */
function addMovie(folder, list, sessionID) {
    let movie = extractDataFromFolderName(folder);
    if (movie && movie.title && movie.year && movie.folder) {
        findMovieMetadata(movie)
            .then((metadata) => {
                let movieID = null;
                if (metadata.total_results > 0) {
                    movieID = metadata.results[0].id;
                } else {
                    console.log(`\x1b[31mCouldn't locate movie in TMDb:`,
                    `${movie.title} (${movie.year}) – ${movie.folder}\x1b[0m`);
                }
                return movieID;
            })
            // TODO: Introduce a Store where
            // remote and local movies can be maintained
            //
            // .then((movieID) => {
            //     let found = list.movies.items.find((item) => {
            //         return item.id === movieID;
            //     });
            //     return found ? null : movieID;
            // })
            .then((movieID) => {
                let result = null;
                if (movieID) {
                    result = addMovieToList(
                        movieID,
                        list.id,
                        sessionID
                    );
                }
                return result;
            })
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
    let matched = folderName.match(/^(.+)\.(\d{4})\./i);
    if (matched && matched.length >= 2) {
        return {
            title: matched[1].replace(/\./g, ' '),
            year: matched[2],
            folder: folderName
        };
    }
}
