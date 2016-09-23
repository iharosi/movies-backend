let fs = require('fs');
let http = require('http');
let path = require('path');

module.exports = {

    /**
     * @param {Array.<Object>} moviesData The metadata of movies
     * @param {string} posterFolder The folder where the posters can be saved
     * @param {function(Array)} callback Function that can be called when data
     * is ready
     */
    getPosters: function getPosters(moviesData, posterFolder, callback) {
        this.moviesData = moviesData;
        this.posterFolder = posterFolder;

        this
            .fetchPosters()
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
     * @param {Object} movieData Metadata of one movie
     *
     * @return {Promise} Movie data expanded with local poster url
     */
    requestPoster: function requestPoster(movieData) {
        return new Promise((resolve, reject) => {
            let match = movieData.Poster.match(/\.[a-zA-Z0-9]+$/);
            if (!match) {
                reject('Invalid extension!');
            }
            let posterLocation = path.join(
                __dirname,
                this.posterFolder,
                movieData.imdbID + match[0]
            );
            let f = fs.createWriteStream(posterLocation);
            http.get(movieData.Poster, (response) => {
                response.on('error', (err) => {
                    reject(err);
                });
                response.on('data', (chunk) => {
                    f.write(chunk);
                });
                response.on('end', () => {
                    f.end();
                    movieData.Poster = 'posters/' + movieData.imdbID + match[0];
                    resolve(movieData);
                });
            });
        });
    },

    /**
    * @return {Promise} Metadata of movies expanded with local poster url
    */
    fetchPosters: function fetchPosters() {
        return Promise.all(
            this.moviesData.map((movieData) => {
                let result;
                if (movieData.Poster === 'N/A') {
                    result = new Promise((resolve) => {
                        resolve(movieData);
                    });
                } else {
                    result = this.requestPoster(movieData);
                }
                return result;
            })
        );
    }

};
