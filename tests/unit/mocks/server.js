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
 * @return {Server}
 */
Server.prototype.listen = function() {
    return this;
};

/**
 * close
 *
 * @return {Server}
 */
Server.prototype.close = function() {
    return this;
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
