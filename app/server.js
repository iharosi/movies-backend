let path = require('path');
let express = require('express');
let bodyParser = require('body-parser');
let favicon = require('serve-favicon');
let morgan = require('morgan');
let cors = require('cors');

module.exports = {

    /**
     * @param {Array.<Object>} data It contains the metada for every movies
     * @param {number} port Port where the server can listen
     * @param {object} options Server can get options like port number
     */
    startServer: function(data, port) {
        port = port || 8080;

        let app = express();
        let server;

        app.use(favicon(path.join(__dirname, '/public/favicon.ico')));
        app.use(express.static(path.join(__dirname, '/public/')));
        app.use(morgan('dev')); /* 'default', 'short', 'tiny', 'dev' */
        app.use(bodyParser.json());
        app.use(cors());

        console.info(`Downloaded ${data.length} entries.`);
        server = app.listen(port, function() {
            console.info('App now running on port', server.address().port);
        });

        app.get('/movies/all', function(req, res) {
            res.header('Access-Control-Allow-Origin', '*');
            res.status(200).json(data);
        });

        app.get('/movies/identified', function(req, res) {
            res.header('Access-Control-Allow-Origin', '*');
            var result = data.filter(function(item) {
                return item.Response === 'True';
            });
            res.status(200).json(result);
        });

        app.get('/movies/unidentified', function(req, res) {
            res.header('Access-Control-Allow-Origin', '*');
            var result = data.filter(function(item) {
                return item.Response === 'False';
            });
            res.status(200).json(result);
        });
    },

    /**
     * @param {Object} res Response from the server
     * @param {Object} reason Error object
     * @param {string} message Error message
     * @param {number} code HTTP status code
     */
    handleError: function(res, reason, message, code) {
        console.log('ERROR: ' + reason);
        res
            .status(code || 500)
            .json({
                error: message
            });
    }

};
