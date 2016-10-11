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

util.inherits(ServiceError, RequestError);
