var EventEmitter = require('events').EventEmitter;
var _            = require('lodash');

module.exports = Server;

/**
 * Server
 *
 */
function Server() {
    EventEmitter.call(this);
    this.port = _.random(3000, 3010);
}

Server.prototype = Object.create(EventEmitter.prototype);
Server.prototype.constructor = Server;

/**
 * listen
 *
 * @param {Integer} val
 * @param {Function} callback
 *
 * @return {Server}
 */
Server.prototype.setTimeout = function(val, callback) {
    this.timeout = val;
    if (callback)
        this.on('timeout', callback);
    return this;
};

/**
 * listen
 *
 * @return {Server}
 */
Server.prototype.listen = function() {
    return this;
};

/**
 * close
 *
 * @param {Function} cb
 * @return {Server}
 */
Server.prototype.close = function(cb) {
    if (typeof cb === 'function') {
        cb();
    }
    return this;
};


/**
 * @param {Integer} timeout
 * @return {undefined}
 */
Server.prototype.setTimeout = function(timeout) {
    this._timeout = timeout;
};


/**
 * address
 *
 * @return {Object}
 */
Server.prototype.address = function() {
    return {
        port: this.port
    };
};
