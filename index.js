/* eslint camelcase: ["error", {properties: "never"}] */

const fs = require('fs');
const co = require('co');
const path = require('path');
const Bottleneck = require('bottleneck');
const TMDbClient = require('./lib/tmdbclient');
const TMDbAuth = require('./lib/tmdbauth');
const Cacher = require('./lib/cacher');

let limiter = new Bottleneck(0, 300);
let config = require('./config.js');
let tmdb = new TMDbClient(config.tmdb.key);
let tmdba = new TMDbAuth(config.tmdb.key);
let cache = new Cacher(path.join(__dirname, './session'));

co(function* () {
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
        let movieDatas = yield extractDataFromFolderNames(
            path.join(__dirname, list.folder)
        );
        let movieMetadatas = yield findMovieMetadatas(movieDatas);
        let localMovies = movieMetadatas.map((metadata, i) => {
            let result = {
                _source: movieDatas[i]
            };
            if (metadata.total_results > 0) {
                Object.assign(result, metadata.results[0]);
            } else {
                console.log(result);
            }
            return result;
        });
        let tmdbMovies = yield tmdb.call(`/list/${list.id}`, {
            session_id: sessionId
        });
        let changes = getDiff(localMovies, tmdbMovies.items);

        yield addOrRemoveMovies(changes, list.id, sessionId);

        logSummary(changes);
    }
}).catch((error) => {
    console.log('Error', error);
    process.exit(0);
});

/**
 * @param {Object} changes The list of removed and added movies
 */
function logSummary(changes) {
    changes.remove = changes.remove.map((movie) => {
        return movie.title;
    });
    changes.add = changes.add.map((movie) => {
        return movie.title;
    });
    if (changes.remove.length) {
        console.log('––– removed –––');
        console.log(changes.remove.join('\n'));
        console.log();
    }
    if (changes.add.length) {
        console.log('––– added –––');
        console.log(changes.add.join('\n'));
        console.log();
    }
}

/**
 * @param {Array.<object>} localMovies Metadatas of local movies
 * @param {Array.<object>} tmdbMovies Metadatas of cloud movies
 *
 * @return {Object} Should be deleted and should be added lists of movies
 */
function getDiff(localMovies, tmdbMovies) {
    return {
        remove: tmdbMovies.filter((tmdbMovie) => {
            return !localMovies.find((localMovie) => {
                return localMovie.id === tmdbMovie.id;
            });
        }),
        add: localMovies.filter((localMovie) => {
            return !tmdbMovies.find((tmdbMovie) => {
                return tmdbMovie.id === localMovie.id;
            });
        })
    };
}

/**
 * @param {Object} movies The list of movies what should be added and/or removed
 * @param {Number} listId The ID of the selected List
 * @param {Number} sessionId Session ID
 *
 * @return {Array.<promise>} An array of API call response bodies
 */
function addOrRemoveMovies(movies, listId, sessionId) {
    return Promise.all(
        movies.remove.map((movie) => {
            return limiter.schedule(
                tmdb.call.bind(
                    tmdb,
                    `/list/${listId}/remove_item`,
                    {
                        session_id: sessionId
                    },
                    'POST',
                    {
                        media_id: movie.id
                    }
                )
            );
        }).concat(movies.add.map((movie) => {
            return limiter.schedule(
                tmdb.call.bind(
                    tmdb,
                    `/list/${listId}/add_item`,
                    {
                        session_id: sessionId
                    },
                    'POST',
                    {
                        media_id: movie.id
                    }
                )
            );
        }))
    );
}

/**
 * @param {Array.<object>} movies Extracted data from folder names
 *
 * @return {Promise} API call response body
 */
function findMovieMetadatas(movies) {
    return Promise.all(
        movies.map((movie) => {
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
        })
    );
}

/**
 * @param {string} sourceDir Where the movie folders can be found
 *
 * @return {Promise} Array contains objects of movie data (title/year)
 */
function extractDataFromFolderNames(sourceDir) {
    return new Promise((resolve, reject) => {
        fs.readdir(sourceDir, (err, items) => {
            if (err) {
                reject(new Error(err));
            }
            if (items && items.length) {
                let data = items
                    .filter((item) => {
                        return fs
                            .statSync(path.join(sourceDir, item))
                            .isDirectory();
                    })
                    .filter((item) => {
                        return item.match(/^(.+)\.(\d{4})\./i) !== null;
                    })
                    .map((item) => {
                        let matched = item.match(/^(.+)\.(\d{4})\./i);
                        return {
                            title: matched[1].replace(/\./g, ' '),
                            year: matched[2],
                            folder: item
                        };
                    });
                resolve(data);
            } else {
                resolve([]);
            }
        });
    });
}
