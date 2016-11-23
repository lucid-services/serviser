var util            = require('util');
var RequestError    = require('./requestError.js');
var HttpStatusCodes = require('http-status-codes');

module.exports = UnauthorizedError;

/**
 * Error UnauthorizedError
 * */
function UnauthorizedError() {

    RequestError.call(this, {
        message: 'Unauthorized',
        code: HttpStatusCodes.UNAUTHORIZED
    });
}

util.inherits(UnauthorizedError, RequestError);
