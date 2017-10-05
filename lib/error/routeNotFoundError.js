const util            = require('util');
const RequestError    = require('./requestError.js');
const HttpStatusCodes = require('http-status-codes');

module.exports = RouteNotFoundError;

/**
 * @constructor
 * @extends RequestError
 **/
function RouteNotFoundError() {

    RequestError.call(this, {
        message: 'Not found',
        code: HttpStatusCodes.NOT_FOUND
    });
}

util.inherits(RouteNotFoundError, RequestError);
