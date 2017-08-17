var util            = require('util');
var RequestError    = require('./requestError.js');
var HttpStatusCodes = require('http-status-codes');

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
 * @return {Object}
 */
ServiceError.prototype.toLogger = function() {
    var out = RequestError.prototype.toLogger.call(this);
    out.context = this.context;

    return out;
};

/**
 * @param {String} id
 *
 * @return {ServiceError} - self
 */
ServiceError.prototype.setOrigin = function(id) {
    this.context.routeUID = id;
    return this;
};

/**
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
