let fs = require('fs');
let path = require('path');
let configLoader = require('./configloader');
let config = configLoader.load(path.join(__dirname, '../config.json'));
let TMDbClient = require('./tmdbclient');
let tmdb = new TMDbClient(config.TMDbAPIkey);
let Bottleneck = require('bottleneck');
let limiter = new Bottleneck(0, 500);
let Store = require('./store');
let db = new Store(config.database);

db.getAll()
    .then((records) => {
        extractDataFromFolderNames(config.sourceFolder)
            .then((movies) => {
                db.delete(
                    records.filter((record) => {
                        return !movies.find((movie) => {
                            return record._source.folder === movie.folder;
                        });
                    }).map((record) => {
                        return parseInt(record.id, 10);
                    })
                ).then((res) => {
                    console.log(res);
                    fetchMetadata(
                        movies.filter((movie) => {
                            return !records.find((record) => {
                                return record._source.folder === movie.folder;
                            });
                        })
                    );
                })
                .catch((err) => {
                    console.log(err);
                });
            })
            .catch((err) => {
                console.log(err);
            });
    })
    .catch((err) => {
        console.log(err);
    });

/**
 * @param {Array.<object>} movies Extracted data from folder names
 *
 * @return {Promise} Return a promise with the summary of changes
 */
function fetchMetadata(movies) {
    return new Promise((resolve, reject) => {
        movies.forEach((movie) => {
            limiter.schedule(function(url, params) {
                return tmdb.call(url, params)
                    .then((res) => {
                        if (res.total_results === 0) {
                            resolve('Missing: ', movie, '\n');
                        } else {
                            res.results[0]._source = movie;
                            console.log('Fetched: ' + res.results[0].title);
                            db.insert(res.results[0])
                                .then((res) => {
                                    resolve(res);
                                })
                                .catch((err) => {
                                    reject(err);
                                });
                        }
                    }).catch((err) => {
                        console.log(err);
                    });
            }, '/search/movie', {
                query: movie.title,
                year: movie.year
            });
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
