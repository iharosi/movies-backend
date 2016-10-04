/* eslint camelcase: ["error", {properties: "never"}] */

const fs = require('fs');
const co = require('co');
const path = require('path');
const Bottleneck = require('bottleneck');
const waitkey = require('./waitkey');
const TMDbClient = require('./tmdbclient');
const Cacher = require('./cacher');

let limiter = new Bottleneck(0, 300);
let config = require(path.join(__dirname, '../config.js'));
let tmdb = new TMDbClient(config.tmdb.key);
let cache = new Cacher(path.join(__dirname, '../cache'));

co(function* () {
    let sessionId = yield cache.getData();
    if (!sessionId || !sessionId.length) {
        sessionId = yield getSessionId();
        cache.setData(sessionId);
    }
    tmdb.config({
        sessionId: sessionId
    });
    let account = yield tmdb.call('/account');
    let createdList = yield tmdb.call(`/account/${account.id}/lists`);
    let listId;
    if (createdList.results.length) {
        let result = createdList.results.find((item) => {
            return item.name === 'My movies';
        });
        if (result) {
            listId = result.id;
        }
    }
    if (!listId) {
        let result = yield tmdb.call('/list', {}, 'POST', {
            name: 'My movies',
            description: '',
            language: 'en'
        });
        listId = result.list_id;
    }
    console.log();
    console.log('api_key:', config.tmdb.key);
    console.log('session_id:', sessionId);
    console.log('account_id:', account.id);
    console.log('list_id:', listId);
    console.log();
    let movieDatas = yield extractDataFromFolderNames(config.sourceFolder);
    let movieMetadatas = yield findMovieMetadatas(movieDatas);
    let localMovies = movieMetadatas.map((metadata, i) => {
        let result = {
            _source: movieDatas[i]
        };
        if (metadata.total_results > 0) {
            Object.assign(result, metadata.results[0]);
        }
        return result;
    });
    let tmdbMovies = yield tmdb.call(`/list/${listId}`);
    let changes = getDiff(localMovies, tmdbMovies.items);

    yield addOrRemoveMovies(changes, listId);

    summary(changes);
}).catch((error) => {
    console.log('Error', error);
    process.exit(0);
});

/**
 * @param {Object} changes The list of removed and added movies
 */
function summary(changes) {
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
 * @return {Promise} New session
 */
function getSessionId() {
    return new Promise((resolve, reject) => {
        tmdb.call('/authentication/token/new')
            .then((auth) => {
                console.log();
                console.log('Approve the application with this URL:');
                console.log(`https://www.themoviedb.org/authenticate/${auth.request_token}`);
                console.log();
                wait()
                    .then(() => {
                        tmdb.call('/authentication/session/new', {
                            request_token: auth.request_token
                        })
                        .then((session) => {
                            resolve(session.session_id);
                        })
                        .catch((err) => {
                            reject(err);
                        });
                    })
                    .catch((err) => {
                        reject(err);
                    });
            })
            .catch((err) => {
                reject(err);
            });
    });
}

/**
 * @return {Promise} undefined
 */
function wait() {
    return new Promise((resolve, reject) => {
        console.log('Press any key to continue...');
        waitkey((res) => {
            if (res) {
                resolve();
            } else {
                reject('^C');
            }
        });
    });
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
 * @param {number} listId The ID of the selected List
 *
 * @return {Array.<promise>} An array of API call response bodies
 */
function addOrRemoveMovies(movies, listId) {
    return Promise.all(
        movies.remove.map((movie) => {
            return limiter.schedule(
                tmdb.call.bind(
                    tmdb,
                    `/list/${listId}/remove_item`,
                    {},
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
                    {},
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
                resolve(
                    items
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
                        })
                );
            } else {
                resolve([]);
            }
        });
    });
}
