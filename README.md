# Movies Web API backend
Backend service which fetches metadata based on movies found in a folder and ensure an API service for web applications.

## Install dependencies

Requirements: [RethinkDB](https://rethinkdb.com), [Node.js](https://nodejs.org/)

On OS X you can install RethinkDB with brew.  
For any other OS check out the [RethinkDB docs](https://www.rethinkdb.com/docs/install/).

1. `brew install rethinkdb`
2. `npm install`

## Set config file

1. `mv config.json.sample config.json`
2. `vim config.json`

## Run

1. `rethinkdb` or to run as a service `brew services start rethinkdb`
2. `npm start`

## Run unit tests and watch nyan cat :)

1. `npm test`
