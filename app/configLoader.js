let fs = require('fs');

module.exports = {

    load: function(file) {
        let config = fs.readFileSync(file);
        try {
            config = JSON.parse(config);
        } catch (e) {
            throw e;
        }
        return config;
    }

};
