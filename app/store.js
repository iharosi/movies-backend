let r = require('rethinkdb');
let path = require('path');
let configLoader = require('./configLoader');
let config = configLoader.load(path.join(__dirname, '../config.json'));
const TABLENAME = 'movies';

module.exports = {

    /**
     * @param {string} msg Message
     */
    log: (msg) => {
        console.log(msg);
    },

    /**
     * @param {object | string} err Error object or error message
     * @param {object} conn RethinkDB connection object
     */
    handleError: function(err, conn) {
        if (err && err.msg) {
            this.log(err.msg);
        } else {
            this.log(err);
        }
        if (conn) {
            conn.close();
        }
        process.exit(0);
    },

    /**
     * @return {Promise} Returns a RethinkDB connect object
     */
    connect: function() {
        return new Promise((resolve, reject) => {
            r.connect({
                host: config.database.host,
                port: config.database.port,
                db: config.database.db,
                user: config.database.user,
                password: config.database.password,
                timeout: 5
            }, (err, conn) => {
                if (err) {
                    reject(err);
                } else {
                    r.tableList().run(conn, (err, res) => {
                        if (err) {
                            reject(err);
                        } else if (res.indexOf(TABLENAME) === -1) {
                            r.tableCreate(TABLENAME).run(conn, (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(conn);
                                }
                            });
                        } else {
                            resolve(conn);
                        }
                    });
                }
            });
        });
    },

    /**
     * @param {Array.<object>} data Contains metadata of movies
     */
    add: function(data) {
        if (Array.isArray(data)) {
            this.connect()
                .then((conn) => {
                    r.table(TABLENAME)
                        .insert(data, {
                            durability: 'hard',
                            returnChanges: false,
                            conflict: 'replace'
                        })
                        .run(conn, (err, res) => {
                            if (err) {
                                this.handleError(err, conn);
                            } else {
                                conn.close();
                                this.log(res);
                            }
                        });
                })
                .catch((err) => {
                    this.handleError(err);
                });
        } else {
            this.handleError('`data` is not an Array!');
        }
    }

};
