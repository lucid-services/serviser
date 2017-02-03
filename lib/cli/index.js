var EventEmitter = require('events').EventEmitter;
var _            = require('lodash');
var Promise      = require('bluebird');
var Vantage      = require('bi-vantage');

var AppManager = require('../express/appManager.js');
var commands   = require('./commands');


module.exports = CLI;

/**
 * CLI
 *
 * @param {Object} options
 * @param {AppManager} appManager
 * @param {Array}  users
 * @param {Object} users[]
 * @param {String} users[].user
 * @param {String} users[].pass
 * @param {String} hashAlgorithm
 *
 */
function CLI(options) {
    EventEmitter.call(this);

    var cli = this;
    var defaults = {
        apps: [],
        users: [],
        hashAlgorithm: null
    };

    this.options = _.assign(defaults, options || {});

    if (!(this.options.appManager instanceof AppManager)) {
        throw new Error('Expected options.appManager to be an instanceof AppManager');
    }

    this.options.apps = this.options.appManager.apps;
    this.apps = [];
    this.server = new Vantage();
    //disable auth
    this.server.auth(function() {
        return function(args, cb) {
            return cb(void 0, true);
        };
    });
    //this.server.auth('basic', {
        //users: options.users || [],
        //hashAlgorithm: options.hashAlgorithm
    //});
    this.server.delimiter('node-app~$');

    //wrap each action method of a command to a function which makes sure that
    //synchronously throwed errors are supressed and logged into stderr
    this.server.on("command_registered", function(opt) {
        var cmd = opt.command;
        var _action = cmd.action;

        cmd.action = function(fn) {
            return _action.call(cmd, function(args, callback) {
                try {
                    return fn.apply(this, arguments);
                } catch(e) {
                    //log error to stderr and continue
                    this.log(e);
                    return callback();
                }
            });
        };
    });

    Object.keys(commands).forEach(function(name) {
        commands[name].build(cli);
    });
}

CLI.prototype = Object.create(EventEmitter.prototype);
CLI.prototype.constructor = CLI;

/**
 *
 * it looks at received configuration (which should be provided by bi-config)
 * and if enabled, starts new CLI server or attaches local CLI console to
 * the main process. if both local cli console and cli server are disabled,
 * it returns null
 *
 * @param {AppManager}   appManager
 * @param {Object}       config
 * @param {String|False} config.listen
 * @param {Boolean}      config.show
 * @param {Array}        [config.users]
 * @param {String}       [config.hashAlgorithm]
 * @return {CLI|null}
 */
CLI.init = function(appManager, config) {
    config = config || {};

    if (config.listen || config.show) {
        var cli = new CLI({
            appManager    : appManager,
            users         : config.users,//currently not used
            hashAlgorithm : config.hashAlgorithm//currently not used
        });

        if (config.listen) {
            cli.listen(config.listen);
        }
        if (config.show) {
            cli.show();
        }

        return cli;
    }

    return null;
};

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

