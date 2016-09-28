/* eslint camelcase: ["error", {properties: "never"}] */

let TMDbClient = function(APIkey) {
    if (!APIkey || APIkey.length !== 32) {
        throw new Error(
            'Invalid API key: You must be granted a valid key.'
        );
    }

    const BASE_PATH = 'https://api.themoviedb.org/3';
    const CONFIG_EXPIRATION = 72; // hours
    let request = require('request');
    let configuration = null;
    let lastConfigDate = Date.now();

    this._fetchConfiguration = function() {
        return new Promise((resolve, reject) => {
            // TMDb suggests to cache this data and check for updates
            // every few days so a new config will be requested when the
            // current config older than 3 days
            let ageOfConfig = Math
                .round((Date.now() - lastConfigDate) / 1000 / 60 / 60);
            if (configuration === null || ageOfConfig > CONFIG_EXPIRATION) {
                this.call('/configuration', {}).then((res) => {
                    lastConfigDate = Date.now();
                    resolve(res);
                }).catch((err) => {
                    reject(err);
                });
            } else {
                resolve(configuration);
            }
        });
    };

    this._createRequestOption = function(url, params) {
        return {
            method: 'GET',
            url: BASE_PATH + url,
            qs: Object.assign(params, {api_key: APIkey}),
            headers: {
                'content-type': 'application/json'
            },
            body: {},
            json: true
        };
    };

    this.call = function(url, params) {
        return new Promise((resolve, reject) => {
            let options = this._createRequestOption(url, params);
            request(options, (error, response, body) => {
                if (error) {
                    reject(new Error(error));
                } else if (response.statusCode === 200) {
                    resolve(body);
                } else {
                    reject(body);
                }
            });
        });
    };
};

module.exports = TMDbClient;
