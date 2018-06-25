const util         = require('util');
const RequestError = require('./requestError.js');

module.exports = ValidationError;

/**
 *
 * @param {Object} context
 * @param {String} context.keyword
 * @param {String} context.dataPath
 * @param {String} context.schemaPath
 * @param {Object} context.params
 * @param {Object} context.parentSchema
 * @param {mixed}  context.data
 * @param {String} context.message
 * @constructor
 * @extends {RequestError}
 **/
function ValidationError(context) {
    context = context || {};

    /**
     * @name ValidationError#code
     * @instance
     * @readonly
     * @default 400
     */

    let message = `${context.dataPath || ValidationError.DATA_PATH} ${context.message}`;

    RequestError.call(this, {
        apiCode: ValidationError.API_CODE,
        message: message
    });
}

/**
 * default error message prefix used for errors with empty invalid property path (eg.: when root data object is invalid)
 * @name ValidationError.DATA_PATH
 * @type {String}
 * @default '$DATA$'
 */
ValidationError.DATA_PATH = '$DATA$';

/**
 * default api_code response value
 * @name ValidationError.API_CODE
 * @type {String}
 * @default 'validationFailure'
 */
ValidationError.API_CODE = 'validationFailure';

util.inherits(ValidationError, RequestError);
