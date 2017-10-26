const util            = require('util');
const RequestError    = require('./requestError.js');
const HttpStatusCodes = require('http-status-codes');

module.exports = ForbiddenError;

/**
 * @constructor
 * @param {String} message
 * @param {String} msg - DEPRECATED - error message provided as the second argument
 * @extends {RequestError}
 **/
function ForbiddenError(message, msg) {

    /**
     * @name ForbiddenError#code
     * @instance
     * @default 403
     */

    /**
     * @name ForbiddenError#message
     * @instance
     * @default 'Forbidden'
     */

    RequestError.call(this, {
        message: message || msg,
        code: HttpStatusCodes.FORBIDDEN,
        desc: 'Forbidden'
    });
}

util.inherits(ForbiddenError, RequestError);
