let Store = function(dbcache) {
    let _db = {
        folders: [],
        locals: [],
        remotes: []
    };

    this.loadDatabase = function(dbobj) {
        _db = dbobj;
    };

    this.saveDatabase = function() {
        dbcache.setData(JSON.stringify(_db));
    };

    this.getFolders = function() {
        return _db.folders;
    };
    this.addFolder = function(obj) {
        let found = _db.folders.find((item) => {
            return item.folder === obj.folder;
        });
        if (!found) {
            _db.folders.push(obj);
            this.saveDatabase();
        }
        return _db.folders;
    };
    this.removeFolder = function(obj) {
        let originalLength = _db.folders.length;
        _db.folders = _db.folders.filter((item) => {
            return item.folder !== obj.folder;
        });
        if (originalLength !== _db.folders.length) {
            this.saveDatabase();
        }
        return _db.folders;
    };
};

module.exports = Store;
