# Movies backend
Backend service which fetches metadata based on movies found in a folder and create a TMDb List of them.

<img src="https://www.themoviedb.org/assets/bb45549239e25f1770d5f76727bcd7c0/images/v4/logos/408x161-powered-by-rectangle-blue.png" width="204" alt="Powered by The Movie Database">

## Install dependencies

Requirements: [Node.js](https://nodejs.org/), [TMDb account](https://www.themoviedb.org/account/signup), [TMDb API key](https://www.themoviedb.org/faq/api?language=en), [TMDb list](https://www.themoviedb.org/documentation/editing/lists)

1. `npm install`

## Create and set config file

1. `mv config.js.sample config.js`
2. use your favourite editor to edit the config file
3. enter your TMDb API key
4. enter your existing TMDb list id(s) and name(s) and pair with your media folder(s)

## Run

For Node.js version ≧ 6

1. `npm start`

For Node.js version ≦ 5

1. `npm run with-babel`
