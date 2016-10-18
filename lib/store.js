const config = require('../config');

let Store = function(dbCacher) {
    let _db = {};

    config.tmdb.lists.forEach((list) => {
        _db[list.id] = [];
    });

    this.loadDatabase = function(dbcache) {
        try {
            _db = JSON.parse(dbcache);
        } catch (error) {
            throw new Error(error);
        }
    };

    this.saveDatabase = function() {
        dbCacher.setData(JSON.stringify(_db));
    };

    this.getAll = function(listID) {
        return _db[listID];
    };

    this.get = function(listID, id) {
        return _db[listID].find((item) => {
            return item.id === id;
        });
    };

    this.find = function(listID, path, value) {
        let arrPath = path.split('.');
        return _db[listID].find((item) => {
            return value === arrPath.reduce((prev, curr) => {
                return prev[curr];
            }, item);
        });
    };

    this.insert = function(listID, data) {
        if (typeof listID !== 'number' || typeof data !== 'object') {
            throw new Error('Missing or invalid parameter!');
        }
        let addedItem = null;
        if (!this.find(listID, 'id', data.id)) {
            _db[listID].push(data);
            addedItem = data;
            this.saveDatabase();
        }
        return addedItem;
    };

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
            this.saveDatabase();
        }
        return key;
    };

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
            this.saveDatabase();
        }
        return removedItem;
    };
};

module.exports = Store;
