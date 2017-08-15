var util            = require('util');
var RequestError    = require('./requestError.js');
var HttpStatusCodes = require('http-status-codes');

module.exports = ValidationError;

/**
 * @constructor
 * @extends RequestError
 **/
function ValidationError(param, message, value) {

    RequestError.call(this, {
        message: message
    });
}

util.inherits(ValidationError, RequestError);
