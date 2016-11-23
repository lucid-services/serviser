var util            = require('util');
var RequestError    = require('./requestError.js');
var HttpStatusCodes = require('http-status-codes');

module.exports = ValidationError;

/**
 * Error UnauthorizedError
 * */
function ValidationError(param, message, value) {

    RequestError.call(this, {
        message: message
    });
}

util.inherits(ValidationError, RequestError);
