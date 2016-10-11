var util         = require('util');
var RequestError = require('./requestError.js');

module.exports = RouteNotFoundError;

/**
 * Error RouteNotFoundError
 * */
function RouteNotFoundError() {

    RequestError.call(this, 'Not found', 404);
}

util.inherits(RouteNotFoundError, RequestError);
