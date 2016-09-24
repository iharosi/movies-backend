// let fs = require('fs');
let path = require('path');
let poster = require('./poster');
let server = require('./server');
let metadata = require('./metadata');
let configLoader = require('./configLoader');

let config = configLoader.load(path.join(__dirname, '../config.json'));

metadata.getData(
    config.sourceFolder,
    config.api.metadata.url,
    (moviesData) => {
        poster.getPosters(
            moviesData,
            config.api.poster.url,
            config.posterFolder,
            (moviesDataWithPosters) => {
                server.startServer(moviesDataWithPosters, config.port);
            }
        );
    }
);
