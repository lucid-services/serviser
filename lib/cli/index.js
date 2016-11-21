var EventEmitter = require('events').EventEmitter;
var _            = require('lodash');
var Promise      = require('bluebird');
var Vantage      = require('vantage');

var AppManager = require('../express/appManager.js');
var commands   = require('./commands');


module.exports = CLI;

/**
 * CLI
 *
 * @param {Object} options
 * @param {AppManager} appManager
 *
 */
function CLI(options) {
    EventEmitter.call(this);

    var defaults = {
        apps: []
    };

    this.options = _.assign(defaults, options || {});

    if (!(this.options.appManager instanceof AppManager)) {
        throw Error('Expected options.appManager to be an instanceof AppManager');
    }

    this.options.apps = this.options.appManager.apps;
    this.apps = [];
    this.server = new Vantage();
    this.server.delimiter('node-app~$');

    var cli = this;
    Object.keys(commands).forEach(function(name) {
        commands[name].build(cli);
    });
}

CLI.prototype = Object.create(EventEmitter.prototype);
CLI.prototype.constructor = CLI;

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
    process.nextTick(function() {
        self.server.server.server.on('listening', function() {
            self.emit('listening', self);
        });
    });

    //TODO it's not 100% ensured that the `listening` listener will be binded
    //before the event is emited
    self.server.listen(function() {
    }, options);
    return this;
};

/**
 * close
 *
 * @return {Promise<CLI>}
 */
CLI.prototype.close = function() {
    var self = this;

    return new Promise(function(resolve, reject) {
        //self.server.server.io.close();
        self.server.server.server.close(function(err) {
            if (err) {
                return reject(err);
            }

            return resolve(self);
        });
    });
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

