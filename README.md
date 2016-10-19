# Movies backend
Backend service which fetches metadata based on movies found in a folder and create a TMDb List of them.

<img src="https://www.themoviedb.org/assets/bb45549239e25f1770d5f76727bcd7c0/images/v4/logos/408x161-powered-by-rectangle-blue.png" width="204" alt="Powered by The Movie Database">

## Install dependencies

Requirements: [Node.js](https://nodejs.org/)

1. `npm install`

## Create and set config file

1. `mv config.js.sample config.js`
2. use your favourite editor to edit the config file
3. enter your TMDb API key
4. enter your existing TMDb list id(s) and name(s) and pair with your media folder(s)

## Run

If your [Node.js](https://nodejs.org/) version is older than 6

1. `npm start`

if your [Node.js](https://nodejs.org/) version is 6.x or newer

1. `npm run with-babel`
