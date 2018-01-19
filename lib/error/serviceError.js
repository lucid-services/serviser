const util            = require('util');
const RequestError    = require('./requestError.js');
const HttpStatusCodes = require('http-status-codes');

module.exports = ServiceError;

/**
 * Represents unexpected internal errors, those will be converted to {@link ServiceError}.  
 * All ServiceError(s) are logged for later investigation and resolve to
 * 500 Internal Server Error req response.
 *
 * @param {Object|String} [context] - data in key-value format which will be included in an error log report (but excluded from any request response)
 * @constructor
 * @extends {RequestError}
 * */
function ServiceError(context) {

    /**
     * @name ServiceError#code
     * @instance
     * @default 500
     */

    /**
     * @name ServiceError#message
     * @instance
     * @default 'Internal Server Error'
     */

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
 * converts error to fromat intended for remote/file logging
 * @return {Object}
 */
ServiceError.prototype.toLogger = function() {
    var out = RequestError.prototype.toLogger.call(this);
    out.context = this.context;

    return out;
};

/**
 * set route origin of the error (where the error has been triggered).  
 * the origin will be set automatically - this should be probably a private method?
 * @param {String} id - route uid
 *
 * @return {ServiceError} - self
 */
ServiceError.prototype.setOrigin = function(id) {
    this.context.routeUID = id;
    return this;
};

/**
 * converts provided error to the ServiceError
 *
 * @param {Error} err
 * @param {Object} [context] - additional ServiceError context object
 * @return {ServiceError}
 */
ServiceError.buildFrom = function(err, context) {
    context = context || {};

    const error = new ServiceError(Object.assign(context, {
        message: err.message
    }));

    error.stack = err.stack;

    return error;
};

util.inherits(ServiceError, RequestError);
