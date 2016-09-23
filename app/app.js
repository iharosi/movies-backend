let path = require('path');
let poster = require('./poster');
let server = require('./server');
let metadata = require('./metadata');
let configLoader = require('./configLoader');

let config = configLoader.load(path.join(__dirname, '../config.json'));

metadata.getData(
    config.sourceFolder,
    config.api.metadata.url,
    (moviesMetadata) => {
        poster.getPosters(
            moviesMetadata,
            config.posterFolder,
            (moviesMetadataWithPosters) => {
                server.startServer(moviesMetadataWithPosters, config.port);
            }
        );
    }
);
