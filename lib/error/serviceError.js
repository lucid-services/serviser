
var util = require('util');

exports = module.exports = ServiceError;

/**
 * Error ServiceError
 * */
function ServiceError(message) {

    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(ServiceError, Error);
