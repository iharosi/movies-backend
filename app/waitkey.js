let keypress = require('keypress');

module.exports = function(callback) {
    var stdin = process.stdin;

    var subscr;
    var unsubscr = function() {
        if (subscr) {
            stdin.removeListener('keypress', subscr);
            stdin.setRawMode(false);
            stdin.pause();
            subscr = null;
        }
    };

    subscr = function(ch, key) {
        if (key) {
            unsubscr();
            if (key.name === 'c' && key.ctrl) {
                callback(false);
            } else {
                callback(true);
            }
        }
    };

    keypress(stdin);
    stdin.on('keypress', subscr);
    stdin.setRawMode(true);
    stdin.resume();

    return unsubscr;
};
