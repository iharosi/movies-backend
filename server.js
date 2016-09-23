const MOVIES_DIR = './mock';
const API_BASE_URL = 'http://www.omdbapi.com';
const PORT = 3001;

let data = require('./data');
let poster = require('./poster');
let path = require('path');
let express = require('express');
let bodyParser = require('body-parser');
let favicon = require('serve-favicon');
let morgan = require('morgan');
let cors = require('cors');

data.getData(MOVIES_DIR, API_BASE_URL, (moviesMetadata) => {
    poster.getPosters(moviesMetadata, (moviesMetadataWithPosters) => {
        startServer(moviesMetadataWithPosters);
    });
});

/**
 * @param {Array.<Object>} moviesData It contains the metada for every movies
 */
function startServer(moviesData) {
    let app = express();
    let server;

    app.use(favicon(path.join(__dirname, 'public/favicon.ico')));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(morgan('dev')); /* 'default', 'short', 'tiny', 'dev' */
    app.use(bodyParser.json());
    app.use(cors());

    console.log(`Downloaded ${moviesData.length} entries.`);
    server = app.listen(PORT, function() {
        var port = server.address().port;
        console.log('App now running on port', port);
    });

    app.get('/movies/all', function(req, res) {
        res.header('Access-Control-Allow-Origin', '*');
        res.status(200).json(moviesData);
    });

    app.get('/movies/identified', function(req, res) {
        res.header('Access-Control-Allow-Origin', '*');
        var result = moviesData.filter(function(item) {
            return item.Response === 'True';
        });
        res.status(200).json(result);
    });

    app.get('/movies/unidentified', function(req, res) {
        res.header('Access-Control-Allow-Origin', '*');
        var result = moviesData.filter(function(item) {
            return item.Response === 'False';
        });
        res.status(200).json(result);
    });
}

/**
 * @param {Object} res Response from the server
 * @param {Object} reason Error object
 * @param {string} message Error message
 * @param {number} code HTTP status code
 */
function handleError(res, reason, message, code) {
    console.log('ERROR: ' + reason);
    res
        .status(code || 500)
        .json({
            error: message
        });
}
