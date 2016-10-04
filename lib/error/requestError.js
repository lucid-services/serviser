
var util = require('util');

module.exports = RequestError;

/**
 * Error RequestError
 * */
function RequestError(message, code) {

    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.code = code || 400;
    this.message = message || 'Bad Request';
}

util.inherits(RequestError, Error);
