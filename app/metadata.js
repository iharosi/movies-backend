let fs = require('fs');
let path = require('path');
let request = require('request');

module.exports = {

    /**
     * @param {string} sourceDir Folder where movies can be found
     * @param {string} apiUrlTemplate API url from where metadata can be fetched
     * @param {function(Array)} callback Function that can be called when data
     * is ready
     */
    getData: function(sourceDir, apiUrlTemplate, callback) {
        this.sourceDir = sourceDir;
        this.apiUrlTemplate = apiUrlTemplate;

        this
            .getMovieTitles()
            .then((movieTitles) => {
                return this.fetchMetadata(movieTitles);
            })
            .then((moviesMetadata) => {
                return Promise.resolve(moviesMetadata);
            })
            .catch((error) => {
                console.log(`Got error: ${error}`);
                throw error;
            })
            .then((result) => {
                callback(result);
            });
    },

    /**
     * @param {string} url The complete URL which contains the querystring
     * @param {Object} item Data to be included in the result
     *
     * @return {Promise} Metadata of one movie
     */
    callApi: function callApi(url, item) {
        return new Promise((resolve, reject) => {
            request.get(url, (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    let result;
                    try {
                        result = JSON.parse(body);
                    } catch (e) {
                        reject(e);
                    }
                    if (result.Response === 'False') {
                        result.Title = item.Title;
                        result.Year = item.Year;
                    }
                    result._source = {
                        folder: item.Folder,
                        title: item.Title,
                        year: item.Year
                    };
                    resolve(result);
                } else {
                    reject(error);
                }
            });
        });
    },

    /**
     * @param {Array.<Object>} movies Movie titles and release years
     *
     * @return {Promise} Metadata of all movies
     */
    fetchMetadata: function fetchMetadata(movies) {
        if (!movies || !Array.isArray(movies) || !movies.length) {
            return;
        }
        return Promise.all(
            movies.map((item) => {
                let url = this.apiUrlTemplate;
                url = url.replace('{title}', encodeURI(item.Title));
                url = url.replace('{year}', item.Year);
                return this.callApi(url, item);
            })
        );
    },

    /**
     * @return {Promise} Movie titles, years and original folder names
     */
    getMovieTitles: function getMovieTitles() {
        return new Promise((resolve, reject) => {
            fs.readdir(this.sourceDir, (err, items) => {
                if (err) {
                    reject(err);
                }
                if (items && items.length) {
                    resolve(
                        items
                            .filter((item) => {
                                return fs
                                    .statSync(path.join(this.sourceDir, item))
                                    .isDirectory();
                            })
                            .filter((item) => {
                                return item.match(/^(.+)\.(\d{4})\./i) !== null;
                            })
                            .map((item) => {
                                var matched = item.match(/^(.+)\.(\d{4})\./i);
                                return {
                                    Title: matched[1],
                                    Year: matched[2],
                                    Folder: item
                                };
                            })
                    );
                } else {
                    resolve([]);
                }
            });
        });
    }

};
