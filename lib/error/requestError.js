
var util = require('util');

exports = module.exports = RequestError;

/**
 * Error RequestError
 * */
function RequestError(message) {

    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(RequestError, Error);
