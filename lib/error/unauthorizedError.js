var util         = require('util');
var RequestError = require('./requestError.js');

module.exports = UnauthorizedError;

/**
 * Error UnauthorizedError
 * */
function UnauthorizedError() {

    RequestError.call(this, 'Unauthorized', 401);
}

util.inherits(UnauthorizedError, RequestError);
