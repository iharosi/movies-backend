const fs = require('fs');
const path = require('path');
const configLoader = require('./configloader');
const TMDbClient = require('./tmdbclient');
const Bottleneck = require('bottleneck');
const Store = require('./store');

let config = configLoader.load(path.join(__dirname, '../config.json'));
let tmdb = new TMDbClient(config.TMDbAPIkey);
let limiter = new Bottleneck(0, 500);
let db = new Store(config.database);

getSourceAndDBdata()
    .then((res) => {
        cleanUpDB(res)
            .then((results) => {
                console.log('Database cleanup:');
                console.log(results);
                console.log('');
            })
            .catch((err) => {
                console.log(err);
            });

        findMovieMetadatas(
            res.movies.filter((movie) => {
                return !res.records.find((record) => {
                    return record._source.folder === movie.folder;
                });
            })
        )
        .then((metadatas) => {
            return metadatas.map((metadata, i) => {
                let result = {
                    _source: res.movies[i]
                };
                if (metadata.total_results > 0) {
                    Object.assign(result, metadata.results[0]);
                }
                return result;
            });
        })
        .then((movies) => {
            console.log(movies);
        })
        .catch((err) => {
            console.log(err);
        });
    });

/**
 * @param {Array.<object>} movies Containing TMDb movie ID at least
 *
 * @return {Promise} Return a promise with the movie videos
 */
function fetchMovieVideos(movies) {
    return Promise.all(
        movies.map((movie) => {
            return limiter.schedule(
                tmdb.call.bind(
                    tmdb,
                    `/movie/${movie.id}/videos`,
                    {}
                )
            );
        })
    );
}

/**
 * @param {Array.<object>} movies Containing TMDb movie ID at least
 *
 * @return {Promise} Return a promise with the movie credits
 */
function fetchMovieCredits(movies) {
    return Promise.all(
        movies.map((movie) => {
            return limiter.schedule(
                tmdb.call.bind(
                    tmdb,
                    `/movie/${movie.id}/credits`,
                    {}
                )
            );
        })
    );
}

/**
 * @param {Array.<object>} movies Containing TMDb movie ID at least
 *
 * @return {Promise} Return a promise with the movie details
 */
function fetchMovieDetails(movies) {
    return Promise.all(
        movies.map((movie) => {
            return limiter.schedule(
                tmdb.call.bind(
                    tmdb,
                    `/movie/${movie.id}`,
                    {}
                )
            );
        })
    );
}

/**
 * @param {Array.<object>} movies Extracted data from folder names
 *
 * @return {Promise} Return a promise with the API call results
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
 * @param {Object} data Contains the extracted data from folder names
 * and latest database records
 *
 * @return {Promise} Returns a promise with the summary of changes
 */
function cleanUpDB(data) {
    return db.delete(
        data.records.filter((record) => {
            return !data.movies.find((movie) => {
                return record._source.folder === movie.folder;
            });
        }).map((record) => {
            return parseInt(record.id, 10);
        })
    );
}

/**
 * @return {Promise} Folder names from source dir and records from DB
 */
function getSourceAndDBdata() {
    return new Promise((resolve, reject) => {
        db.getAll()
            .then((records) => {
                extractDataFromFolderNames(config.sourceFolder)
                    .then((movies) => {
                        resolve({
                            records: records,
                            movies: movies
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
