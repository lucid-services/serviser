const util = require('util');

module.exports = RouteError;

/**
 * @param {String} message
 * @constructor
 * @extends Error
 **/
function RouteError(message) {

    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(RouteError, Error);
