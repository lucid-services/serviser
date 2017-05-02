var util            = require('util');
var RequestError    = require('./requestError.js');
var HttpStatusCodes = require('http-status-codes');

module.exports = ServiceError;

/**
 * Error ServiceError
 *
 * @param {Object} [context]
 * */
function ServiceError(context) {

    RequestError.call(this, {
        message: 'Internal Server Error',
        code: HttpStatusCodes.INTERNAL_SERVER_ERROR,
        desc: "Please, contact official support. Don't repeat the request in the nearest future."
    });

    this.context = context;
}

ServiceError.buildFrom = function(err) {
    var error = new ServiceError({
        message: err.message
    });

    error.stack = err.stack;

    return error;
};

util.inherits(ServiceError, RequestError);
