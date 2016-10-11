var util = require('util');

module.exports = RouteNotFoundError;

/**
 * Error RouteNotFoundError
 * */
function RouteNotFoundError() {

    RequestError.call(this, 'Unauthorized', 401);
}

util.inherits(RouteNotFoundError, RequestError);
