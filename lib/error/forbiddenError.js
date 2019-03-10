const util            = require('util');
const RequestError    = require('./requestError.js');
const HttpStatusCodes = require('http-status-codes');

module.exports = ForbiddenError;

/**
 * @constructor
 * @param {String} message
 * @extends {RequestError}
 **/
function ForbiddenError(message) {

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
        message: message,
        code: HttpStatusCodes.FORBIDDEN,
        desc: 'Forbidden'
    });
}

util.inherits(ForbiddenError, RequestError);
