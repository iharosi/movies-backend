let Cacher = function(file) {
    if (!file) {
        throw new Error('Missing file!');
    }
    let fs = require('fs');
    this.file = file;

    this.setData = function(str) {
        return new Promise((resolve, reject) => {
            fs.writeFile(this.file, str, {encoding: 'utf8'}, (err) => {
                if (err) {
                    reject(new Error(err));
                }
                resolve();
            });
        });
    };

    this.getData = function() {
        return new Promise((resolve, reject) => {
            fs.readFile(this.file, {encoding: 'utf8'}, (err, data) => {
                if (err) {
                    reject(new Error(err));
                }
                resolve(data);
            });
        });
    };
};

module.exports = Cacher;
