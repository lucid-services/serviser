const util            = require('util');
const RequestError    = require('./requestError.js');
const HttpStatusCodes = require('http-status-codes');

module.exports = UnauthorizedError;

/**
 * @constructor
 * @extends {RequestError}
 * @param {Object} [options]
 * @param {String} [options.apiCode]
 **/
function UnauthorizedError(options) {

    /**
     * @name UnauthorizedError#code
     * @instance
     * @default 401
     */

    /**
     * @name UnauthorizedError#message
     * @instance
     * @default 'Unauthorized'
     */

    RequestError.call(this, {
        message : 'Unauthorized',
        code    : HttpStatusCodes.UNAUTHORIZED,
        apiCode : options && options.apiCode,
        desc    : 'UNAUTHORIZED'
    });
}

util.inherits(UnauthorizedError, RequestError);
