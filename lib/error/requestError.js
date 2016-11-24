var _               = require('lodash');
var util            = require('util');
var HttpStatusCodes = require('http-status-codes');

module.exports = RequestError;

/**
 * Error RequestError
 *
 * @param {Object|String} [options] options object or string message value
 * @param {Integer}       [options.code] - applies only when `apiCode` option is not set
 * @param {String}        [options.apiCode]
 * @param {message}       [options.message]
 * */
function RequestError(options) {

    var defaults = {
        code: HttpStatusCodes.BAD_REQUEST,
        apiCode: null,
        message: 'Bad Request',
    };

    if (typeof options === 'string') {
        options = {message: options};
    }

    options = _.assign(defaults, options);

    if (options.apiCode && options.code !== HttpStatusCodes.BAD_REQUEST) {
        throw new Error('The http status code must resolve to `400 - Bad request` when custom `apiCode` is set');
    }

    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor);

    this.success  = false;
    this.name     = this.constructor.name;
    this.code     = options.code;
    this.apiCode = options.apiCode;
    this.message  = options.message;
}

util.inherits(RequestError, Error);

RequestError.prototype.setUID = function(uid) {
    this.uid = uid;
};

RequestError.prototype.toJSON = function() {
    return {
        api_code : this.apiCode,
        code     : this.code,
        message  : this.message,
        uid      : this.uid,
        success  : this.success
    };
};
