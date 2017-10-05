const util            = require('util');
const RequestError    = require('./requestError.js');
const HttpStatusCodes = require('http-status-codes');

module.exports = UnauthorizedError;

/**
 * @constructor
 * @extends Error
 * @param {Object} [options]
 * @param {String} [options.apiCode]
 **/
function UnauthorizedError(options) {

    RequestError.call(this, {
        message : 'Unauthorized',
        code    : HttpStatusCodes.UNAUTHORIZED,
        apiCode : options && options.apiCode,
        desc    : 'UNAUTHORIZED'
    });
}

util.inherits(UnauthorizedError, RequestError);
