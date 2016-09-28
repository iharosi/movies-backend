let Store = function(config) {
    const TABLENAME = 'movies';
    let r = require('rethinkdb');

    config = {
        host: config.host || 'localhost',
        port: config.port || 28015,
        db: config.db || 'media',
        user: config.user || 'admin',
        password: config.password || '',
        timeout: config.timeout || 5
    };

    /**
     * @return {Promise} Returns a RethinkDB connect object
     */
    this._connect = function() {
        return new Promise((resolve, reject) => {
            r.connect({
                host: config.host,
                port: config.port,
                db: config.db,
                user: config.user,
                password: config.password,
                timeout: config.timeout
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
    };

    /**
     * @return {Promise} Return a promise with the summary of changes
     */
    this.clear = function() {
        return new Promise((resolve, reject) => {
            this._connect()
                .then((conn) => {
                    r.table(TABLENAME)
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
        });
    };

    /**
     * @return {Promise} Return a promise with all the data in the table
     */
    this.getAll = function() {
        return new Promise((resolve, reject) => {
            this._connect()
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
    };

    /**
     * @param {Array.<object> | object} data Contains metadata of movie(s)
     *
     * @return {Promise} Return a promise with the summary of changes
     */
    this.insert = function(data) {
        return new Promise((resolve, reject) => {
            if (data) {
                this._connect()
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
    };

    /**
     * @param {object} data Contains metadata of one movie
     *
     * @return {Promise} Return a promise with the summary of changes
     */
    this.update = function(data) {
        return new Promise((resolve, reject) => {
            if (data && data.id) {
                this._connect()
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
    };

    /**
     * @param {Array.<number> | number} key ID/IDs which should be deleted
     *
     * @return {Promise} Return a promise with the summary of changes
     */
    this.delete = function(key) {
        return new Promise((resolve, reject) => {
            if (Array.isArray(key)) {
                this._connect()
                    .then((conn) => {
                        r.table(TABLENAME)
                            .getAll(...key)
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
            } else if (typeof key === 'number') {
                this._connect()
                    .then((conn) => {
                        r.table(TABLENAME)
                            .get(key)
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
    };

    /**
     * @param {Array.<object>} data Contains fetched movie datas
     *
     * @return {Promise} Return a promise with the summary of changes
     */
    this.cleanDiff = function(data) {
        return new Promise((resolve, reject) => {
            if (data && Array.isArray(data)) {
                this.getAll()
                    .then((res) => {
                        let result = res.filter((movie) => {
                            return !data.find((oneData) => {
                                return oneData.id === movie.id;
                            });
                        });
                        if (Array.isArray(result) && result.length > 0) {
                            let result = res.filter((movie) => {
                                return !data.find((oneData) => {
                                    return oneData.id === movie.id;
                                });
                            })
                            .map((movie) => {
                                return parseInt(movie.id, 10);
                            });
                            this.delete(result)
                                .then((res) => {
                                    resolve(res);
                                })
                                .catch((err) => {
                                    reject(err);
                                });
                        } else {
                            resolve({
                                deleted: 0
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
    };
};

module.exports = Store;
