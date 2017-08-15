var util            = require('util');
var RequestError    = require('./requestError.js');
var HttpStatusCodes = require('http-status-codes');

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
