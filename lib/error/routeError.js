var util = require('util');

exports = module.exports = RouteError;

/**
 * Error RouteError
 * */
function RouteError(message) {

    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(RouteError, Error);
