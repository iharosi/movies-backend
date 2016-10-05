/* eslint camelcase: ["error", {properties: "never"}] */

let TMDbClient = function(key) {
    if (!key || key.length !== 32) {
        throw new Error(
            'Invalid API key: You must be granted a valid key.'
        );
    }

    const request = require('request');

    let configuration = null;
    let lastConfigDate = Date.now();

    this.key = key;
    this.basePath = 'https://api.themoviedb.org/3';
    this.configExpiration = 72; // hours

    /**
     * @return {Promise} Get API configuration information.
     */
    this._fetchConfiguration = function() {
        return new Promise((resolve, reject) => {
            // TMDb suggests to cache this data and check for updates
            // every few days so a new config will be requested when the
            // current config older than what have been set in configExpiration
            let ageOfConfig = Math
                .round((Date.now() - lastConfigDate) / 1000 / 60 / 60);
            if (configuration === null || ageOfConfig > this.configExpiration) {
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

    /**
     * @param {string} url API endpoint path (required)
     * @param {object} params Query string parameters (optional)
     * @param {string} method HTTP method (optional, default is: GET)
     * @param {object} body Request body (optional)
     *
     * @return {object} The final request options
     */
    this._createRequestOption = function(url, params, method, body) {
        params = params || {};
        method = method || 'GET';
        body = body || {};
        let queryString = Object.assign(params, {api_key: this.key});
        if (this.sessionId) {
            Object.assign(queryString, {session_id: this.sessionId});
        }
        return {
            method: method,
            url: this.basePath + url,
            qs: queryString,
            headers: {
                'content-type': 'application/json;charset=utf-8'
            },
            body: body,
            json: true
        };
    };

    /**
     * @param {object} options Change variables or set session_id
     */
    this.config = function(options) {
        if (typeof options === 'object') {
            Object.getOwnPropertyNames(options).forEach((property) => {
                this[property] = options[property];
            });
        }
    };

    /**
     * @param {string} url API endpoint path (required)
     * @param {object} params Query string parameters (optional)
     * @param {string} method HTTP method (optional, default is: GET)
     * @param {object} body Request body (optional)
     *
     * @return {Promise} Request response body
     */
    this.call = function(url, params, method, body) {
        return new Promise((resolve, reject) => {
            let options = this._createRequestOption(url, params, method, body);
            request(options, (error, response, body) => {
                if (error) {
                    reject(new Error(error));
                } else if (response.statusCode.toString()[0] === '2') {
                    resolve(body);
                } else {
                    reject(body);
                }
            });
        });
    };
};

module.exports = TMDbClient;
