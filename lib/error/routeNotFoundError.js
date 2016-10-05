var util = require('util');

module.exports = RouteNotFoundError;

/**
 * Error RouteNotFoundError
 * */
function RouteNotFoundError(message, code) {

    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(RouteNotFoundError, Error);
