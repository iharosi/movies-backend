let fs = require('fs');
let https = require('https');
let path = require('path');

module.exports = {

    /**
     * @param {Array.<Object>} moviesData The metadata of movies
     * @param {string} apiUrlTemplate API url from where posters can be fetched
     * @param {string} posterFolder The folder where the posters can be saved
     * @param {function(Array)} callback Function that can be called when data
     * is ready
     */
    getPosters: function(moviesData, apiUrlTemplate, posterFolder, callback) {
        this.moviesData = moviesData;
        this.apiUrlTemplate = apiUrlTemplate;
        this.posterFolder = posterFolder;

        this
            .createRequests()
            .then((moviesData) => {
                return Promise.resolve(moviesData);
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
     * @param {Object} movieData Metadata of one movie
     *
     * @return {Promise} Movie data expanded with local poster url
     */
    callApi: function(url, movieData) {
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                let extension = '.' + response
                    .headers['content-type']
                    .split(/\//)
                    .pop();
                if (extension === '.html') {
                    movieData.Poster = 'N/A';
                    resolve(movieData);
                } else {
                    let f = fs.createWriteStream(
                        path.join(
                            __dirname,
                            this.posterFolder,
                            movieData.imdbID + extension
                        )
                    );
                    response.on('error', (err) => {
                        reject(err);
                    });
                    response.on('data', (chunk) => {
                        f.write(chunk);
                    });
                    response.on('end', () => {
                        f.end();
                        movieData.Poster = path.join(
                            'posters/',
                            movieData.imdbID + extension
                        );
                        resolve(movieData);
                    });
                }
            });
        });
    },

    /**
    * @return {Promise} Metadata of movies expanded with local poster url
    */
    createRequests: function() {
        return Promise.all(
            this.moviesData.map((movieData) => {
                let newMovieData;
                if (movieData.imdbID) {
                    let url = this.apiUrlTemplate;
                    url = url.replace('{imdbID}', movieData.imdbID);
                    newMovieData = this.callApi(url, movieData);
                } else {
                    newMovieData = new Promise((resolve, reject) => {
                        reject('Missing imdbID!');
                    });
                }
                return newMovieData;
            })
        );
    }

};
