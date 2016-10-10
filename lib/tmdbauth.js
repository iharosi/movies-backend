/* eslint camelcase: ["error", {properties: "never"}] */

let TMDbAuth = function(key) {
    if (!key || key.length !== 32) {
        throw new Error(
            'Invalid API key: You must be granted a valid key.'
        );
    }

    const TMDbClient = require('./tmdbclient');
    const waitkey = require('./waitkey');
    let tmdb = new TMDbClient(key);

    /**
     * @return {Promise} Session ID
     */
    this.getAuthenticated = function() {
        return new Promise((resolve, reject) => {
            tmdb.call('/authentication/token/new')
                .then((auth) => {
                    console.log();
                    console.log('Approve the application with this URL:');
                    console.log(`https://www.themoviedb.org/authenticate/${auth.request_token}`);
                    console.log();
                    this._wait()
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
    };

    /**
     * @return {Promise} undefined
     */
    this._wait = function() {
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
    };
};

module.exports = TMDbAuth;
