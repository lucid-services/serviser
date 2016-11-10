var _         = require('lodash');
var Vantage   = require('vantage');

var App      = require('../express/app.js');
var commands = require('./commands');


module.exports = CLI;

/**
 * CLI
 *
 * @param {Object} options
 * @param {Array<App>} options.apps
 *
 */
function CLI(options) {
    var defaults = {
        apps: []
    };

    this.options = _.assign(defaults, options || {});

    if (!Array.isArray(this.options.apps)) {
        throw Error('Expected options.apps to be an array, got: ' + this.options.apps);
    }

    this.options.apps.forEach(function(app, index) {
        if (!(app instanceof App)) {
            throw Error(`Expected options.apps[${index}] to be an instanceof App`);
        }
    });

    this.apps = [];
    this.server = new Vantage();

    var cli = this;
    Object.keys(commands).forEach(function(name) {
        commands[name].build(cli);
    });
}

/**
 * listen
 *
 * @param {String}  port
 * @param {Object}  [options]
 * @param {Boolean} [options.ssl=false]
 * @param {Boolean} [options.logActivity=false]
 *
 * @return {CLI}
 */
CLI.prototype.listen = function(port, options) {
    var self = this;
    options = _.clone(options || {});

    options.port = port;
    self.server.listen(function() {
    }, options);
    return this;
};

/**
 * show
 *
 * @return {CLI}
 */
CLI.prototype.show = function() {
    this.server.show();
    return this;
};

