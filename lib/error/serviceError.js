var util         = require('util');
var RequestError = require('./requestError.js');

module.exports = ServiceError;

/**
 * Error ServiceError
 *
 * @param {Object} [context]
 * */
function ServiceError(context) {

    RequestError.call(this, 'Internal Server Error', 500);

    this.context = context;
}

ServiceError.buildFrom = function(err) {
    var error = new ServiceError({
        info: err.message
    });

    error.stack = err.stack;

    return error;
};

util.inherits(ServiceError, RequestError);
