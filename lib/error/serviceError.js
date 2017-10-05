const util            = require('util');
const RequestError    = require('./requestError.js');
const HttpStatusCodes = require('http-status-codes');

module.exports = ServiceError;

/**
 * @param {Object|String} [context]
 * @constructor
 * @extends RequestError
 * */
function ServiceError(context) {

    RequestError.call(this, {
        message: 'Internal Server Error',
        code: HttpStatusCodes.INTERNAL_SERVER_ERROR,
        desc: "Please, contact official support. Don't repeat the request in the nearest future."
    });

    if (context && typeof context !== 'object') {
        context = {message: context};
    }

    this.context = context || {};
}

/**
 * converts error to fromat intendet for remote/file logging
 * @return {Object}
 */
ServiceError.prototype.toLogger = function() {
    var out = RequestError.prototype.toLogger.call(this);
    out.context = this.context;

    return out;
};

/**
 * set route origin of the error (where the error has been triggered)
 * @param {String} id - route uid
 *
 * @return {ServiceError} - self
 */
ServiceError.prototype.setOrigin = function(id) {
    this.context.routeUID = id;
    return this;
};

/**
 * converts received error to the ServiceError
 *
 * @param {Error} err
 * @return {ServiceError}
 */
ServiceError.buildFrom = function(err) {
    var error = new ServiceError({
        message: err.message
    });

    error.stack = err.stack;

    return error;
};

util.inherits(ServiceError, RequestError);
