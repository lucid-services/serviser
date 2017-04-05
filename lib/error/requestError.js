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
 * @param {message}       [options.desc] - description for swagger doc spec - is intended to be used in child Error constructor only
 * */
function RequestError(options) {

    var defaults = {
        code: HttpStatusCodes.BAD_REQUEST,
        apiCode: null,
        message: 'Bad Request',
        desc: 'Invalid or insufficient request data. Please modify the request in order to proceed',
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

    this.desc     = options.desc;
    this.name     = this.constructor.name;
    this.code     = options.code;
    this.apiCode  = options.apiCode;
    this.message  = options.message;
    this.uid      = null;
}

util.inherits(RequestError, Error);

/**
 *
 * @return {Object}
 */
RequestError.prototype.toSwagger = function() {
    var schema = {
        description: this.desc,
        schema: {
            type: "object",
            required: [ 'code', 'uid', 'message' ],
            properties: {
                code: {
                    type: "integer",
                    format: "int64",
                    example: this.code
                },
                uid: { type: "float" },
                message: {
                    type: "string",
                    format: "varchar(255)",
                    example: this.message || ""
                }
            }
        }
    };

    if (this.code === HttpStatusCodes.BAD_REQUEST) {
        schema.schema.properties.api_code = {
            type: "string",
            format: "varchar(255)",
            example: "service.failureIdentifier"
        };

        if (this.apiCode) {
            schema.schema.properties.api_code.enum = [this.apiCode];
        }
    }

    return schema;
};

RequestError.prototype.setUID = function(uid) {
    this.uid = uid;
};

RequestError.prototype.toJSON = function() {
    return {
        api_code : this.apiCode,
        code     : this.code,
        message  : this.message,
        uid      : this.uid
    };
};
