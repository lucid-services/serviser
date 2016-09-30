var util = require('util');

exports = module.exports = CacheError;

/**
 * Error CacheError
 * */
function CacheError(message) {

    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(CacheError, Error);
