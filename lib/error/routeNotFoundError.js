var util            = require('util');
var RequestError    = require('./requestError.js');
var HttpStatusCodes = require('http-status-codes');

module.exports = RouteNotFoundError;

/**
 * Error RouteNotFoundError
 * */
function RouteNotFoundError() {

    RequestError.call(this, 'Not found', HttpStatusCodes.NOT_FOUND);
}

util.inherits(RouteNotFoundError, RequestError);
