var _         = require('lodash');
var Vantage   = require('vantage');

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
    this.options = options;
    this.apps = [];
    this.server = new Vantage();

    commands.integrity(this);
    commands.use(this);
    commands.using(this);
    commands.ls(this);
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

    self.server.listen(port, options);
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

