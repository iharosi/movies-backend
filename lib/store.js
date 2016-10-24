/**
 * @param {Array.<object>} TMDbLists Array of objects which contains data about TMDb lists
 * @param {Object} dbCacher Helper which has getData and a setData method
 */
let Store = function(TMDbLists, dbCacher) {
    if (!Array.isArray(TMDbLists)) {
        throw new Error('TMDbLists parameter missing or incorrect!' +
            'It should be an array of objects!');
    }

    let _db = {};

    TMDbLists.forEach((list) => {
        _db[list.id] = [];
    });

    /**
     * Saves the db to a file with the help of a dbCacher
     */
    this._saveDatabase = function() {
        if (dbCacher) {
            dbCacher.setData(JSON.stringify(_db));
        }
    };

    /**
     * Parses a JSON string and adds it to the global _db variable;
     *
     * @param {String} initialData Stringified JSON database
     */
    this.loadDatabase = function(initialData) {
        try {
            _db = JSON.parse(initialData);
        } catch (error) {
            throw new Error(error);
        }
    };

    /**
     * @param {Number} listID TMDb list ID
     *
     * @return {Array.<object>} Array of records
     */
    this.getAll = function(listID) {
        return _db[listID];
    };

    /**
     * @param {Number} listID TMDb list ID
     * @param {Number} id TMDb movie ID
     *
     * @return {Object|undefined} Returns with the record or undefined
     */
    this.get = function(listID, id) {
        return _db[listID].find((item) => {
            return item.id === id;
        });
    };

    /**
     * @param {Number} listID TMDb list ID
     * @param {String} path Object key, it can be a path separated by a dot
     * @param {*} value The value which the found data compares to
     *
     * @return {Object|undefined} Returns with the record or undefined
     */
    this.find = function(listID, path, value) {
        let arrPath = path.split('.');
        return _db[listID].find((item) => {
            return value === arrPath.reduce((prev, curr) => {
                return prev[curr];
            }, item);
        });
    };

    /**
     * @param {Number} listID TMDb list ID
     * @param {Object} data TMDb movie metadata
     *
     * @return {Object|null} Returns with the record or null
     */
    this.insert = function(listID, data) {
        if (typeof listID !== 'number' || typeof data !== 'object') {
            throw new Error('Missing or invalid parameter!');
        }
        let addedItem = null;
        if (!this.find(listID, 'id', data.id)) {
            _db[listID].push(data);
            addedItem = data;
            this._saveDatabase();
        }
        return addedItem;
    };

    /**
     * @param {Number} listID TMDb list ID
     * @param {Number} id TMDb movie ID
     * @param {Object} data TMDb movie metadata
     *
     * @return {Number|null} Returns with the index of the updated record
     */
    this.update = function(listID, id, data) {
        if (typeof listID !== 'number' ||
            typeof id !== 'string' ||
            typeof data !== 'object') {
            throw new Error('Missing or invalid parameter!');
        }
        let key = _db[listID].findIndex((item) => {
            return item.id === id;
        });
        if (key === -1) {
            key = null;
        } else {
            Object.assign(_db[listID][key], data);
            this._saveDatabase();
        }
        return key;
    };

    /**
     * @param {Number} listID TMDb list ID
     * @param {Number} id TMDb movie ID
     *
     * @return {Object|null} Returns with teh removed record or null
     */
    this.delete = function(listID, id) {
        if (typeof listID !== 'number' || typeof id !== 'string') {
            throw new Error('Missing or invalid parameter!');
        }
        let removedItem = null;
        let originalLength = _db[listID].length;
        _db[listID] = _db[listID].filter((item) => {
            if (item.id === id) {
                removedItem = item;
            }
            return item.id !== id;
        });
        if (originalLength !== _db[listID].length) {
            this._saveDatabase();
        }
        return removedItem;
    };
};

module.exports = Store;
