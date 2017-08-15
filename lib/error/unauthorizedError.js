var util            = require('util');
var RequestError    = require('./requestError.js');
var HttpStatusCodes = require('http-status-codes');

module.exports = UnauthorizedError;

/**
 * @constructor
 * @extends Error
 **/
function UnauthorizedError() {

    RequestError.call(this, {
        message: 'Unauthorized',
        code: HttpStatusCodes.UNAUTHORIZED,
        desc: 'Invalid credentials (eg. of client or access, refresh token)'
    });
}

util.inherits(UnauthorizedError, RequestError);
