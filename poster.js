const POSTER_LOCATION = './public/posters/';

let fs = require('fs');
let http=require('http');

module.exports = {

  /**
    * @param {Array.<Object>} moviesData
    * @param {function(Array)} callback
    */
  getPosters: function getPosters(moviesData, callback) {
    this.moviesData = moviesData;

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
    * @param {Object} movieData
    *
    * @return {Promise}
    */
  requestPoster: function requestPoster(movieData) {
    return new Promise((resolve, reject) => {
      let match = movieData.Poster.match(/\.[a-zA-Z0-9]+$/);
      if (!match) {
        reject('Invalid extension!');
      }
      let posterLocation = POSTER_LOCATION + movieData.imdbID + match[0];
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
    * @return {Promise}
    */
  fetchPosters: function fetchPosters() {
    return Promise.all(
      this.moviesData.map((movieData) => {
        if (movieData.Poster !== 'N/A') {
          return this.requestPoster(movieData);
        } else {
          return new Promise((resolve) => {
            resolve(movieData);
          });
        }
      })
    );
  }

};
