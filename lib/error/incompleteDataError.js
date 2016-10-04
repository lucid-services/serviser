var util = require('util');

module.exports = IncompleteDataError;

/**
 * Error IncompleteDataError
 **/
function IncompleteDataError() {

    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
}

util.inherits(IncompleteDataError, Error);
