var util = require('util');

module.exports = ServiceError;

/**
 * Error ServiceError
 *
 * @param {Object} [context]
 **/
function ServiceError(context) {

    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.code = 500;
    this.context = context;
    this.message = 'Internal Server Error';
}

util.inherits(ServiceError, Error);
