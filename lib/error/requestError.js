const _               = require('lodash');
const util            = require('util');
const HttpStatusCodes = require('http-status-codes');

module.exports = RequestError;

/**
 * @param {Object|String} [options] options object or string message value
 * @param {Integer}       [options.code] - applies only when `apiCode` option is not set
 * @param {String}        [options.apiCode]
 * @param {message}       [options.message]
 * @param {message}       [options.desc] - description for swagger doc spec - is intended to be used in child Error constructor only
 *
 * @constructor
 * @extends Error
 **/
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
 * @param {String|Integer} uid
 */
RequestError.prototype.setUID = function(uid) {
    this.uid = uid;
};

/**
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

/**
 * @return {Object}
 */
RequestError.prototype.toLogger = function() {
    return this.toJSON();
};

/**
 * @return {Object}
 */
RequestError.prototype.toJSON = function() {
    return {
        api_code : this.apiCode,
        code     : this.code,
        message  : this.message,
        uid      : this.uid
    };
};
