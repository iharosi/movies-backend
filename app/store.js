const TABLENAME = 'movies';

let r = require('rethinkdb');
let path = require('path');
let configLoader = require('./configLoader');
let config = configLoader.load(path.join(__dirname, '../config.json'));

module.exports = {

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
                            conn.close();
                            reject(err);
                        } else if (res.indexOf(TABLENAME) === -1) {
                            r.tableCreate(TABLENAME).run(conn, (err) => {
                                if (err) {
                                    conn.close();
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
     * @return {Promise} Return a promise with all the data in the table
     */
    getAll: function() {
        return new Promise((resolve, reject) => {
            this.connect()
                .then((conn) => {
                    r.table(TABLENAME)
                        .run(conn, (err, cursor) => {
                            conn.close();
                            if (err) {
                                reject(err);
                            } else {
                                cursor.toArray(function(err, result) {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve(result);
                                    }
                                });
                            }
                        });
                })
                .catch((err) => {
                    reject(err);
                });
        });
    },

    /**
     * @param {Array.<object> | object} data Contains metadata of movie(s)
     *
     * @return {Promise} Return a promise with the summary of changes
     */
    insert: function(data) {
        return new Promise((resolve, reject) => {
            if (data) {
                this.connect()
                    .then((conn) => {
                        r.table(TABLENAME)
                            .insert(data, {
                                durability: 'hard',
                                returnChanges: false,
                                conflict: 'replace'
                            })
                            .run(conn, (err, res) => {
                                conn.close();
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(res);
                                }
                            });
                    })
                    .catch((err) => {
                        reject(err);
                    });
            } else {
                reject('`data` is missing!');
            }
        });
    },

    /**
     * @param {object} data Contains metadata of one movie
     *
     * @return {Promise} Return a promise with the summary of changes
     */
    update: function(data) {
        return new Promise((resolve, reject) => {
            if (data && data.id) {
                this.connect()
                    .then((conn) => {
                        r.table(TABLENAME)
                            .get(data.id)
                            .update(data, {
                                durability: 'hard',
                                returnChanges: false,
                                nonAtomic: false
                            })
                            .run(conn, (err, res) => {
                                conn.close();
                                if (err) {
                                    reject(err, conn);
                                } else {
                                    resolve(res);
                                }
                            });
                    })
                    .catch((err) => {
                        reject(err);
                    });
            } else {
                reject('`data` is not valid!');
            }
        });
    },

    /**
     * @param {number} id The ID of an objct of data in the database table
     *
     * @return {Promise} Return a promise with the summary of changes
     */
    delete: function(id) {
        return new Promise((resolve, reject) => {
            if (id) {
                this.connect()
                    .then((conn) => {
                        r.table(TABLENAME)
                            .get(id)
                            .delete()
                            .run(conn, (err, res) => {
                                conn.close();
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(res);
                                }
                            });
                    })
                    .catch((err) => {
                        reject(err);
                    });
            } else {
                reject('`id` is missing!');
            }
        });
    },

    /**
     * @param {Array.<object>} data Contains fetched movie datas
     *
     * @return {Promise} Return a promise with the summary of changes
     */
    clean: function(data) {
        return new Promise((resolve, reject) => {
            if (data && Array.isArray(data)) {
                this.getAll()
                    .then((res) => {
                        let result = res.filter((movie) => {
                            return !data.find((oneData) => {
                                return oneData.id === movie.id;
                            });
                        })
                        .map((movie) => {
                            return this.delete(movie.id);
                        });
                        if (result && Array.isArray(result)) {
                            Promise.all(result)
                                .then((res) => {
                                    resolve(res);
                                })
                                .catch((err) => {
                                    reject(err);
                                });
                        }
                    })
                    .catch((err) => {
                        reject(err);
                    });
            } else {
                reject('`data` is missing or not an Array!');
            }
        });
    }

};
