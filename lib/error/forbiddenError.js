var util            = require('util');
var RequestError    = require('./requestError.js');
var HttpStatusCodes = require('http-status-codes');

module.exports = ForbiddenError;

/**
 * Error UnauthorizedError
 * */
function ForbiddenError(param, message, value) {

    RequestError.call(this, {
        message: message,
        code: HttpStatusCodes.FORBIDDEN,
        desc: 'Forbidden'
    });
}

util.inherits(ForbiddenError, RequestError);
