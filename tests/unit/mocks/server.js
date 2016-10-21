var EventEmitter = require('events').EventEmitter;

module.exports = Server;

/**
 * Server
 *
 */
function Server() {
    EventEmitter.call(this);
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
