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
     * @default 400
     */

    let message = `${context.dataPath || ValidationError.DATA_PATH} ${context.message}`;

    RequestError.call(this, {
        message: message
    });
}

/**
 * default error message prefix used for errors with empty invalid property path (eg.: when root data objet is invalid)
 * @name ValidationError.DATA_PATH
 * @type {String}
 * @default '$DATA$'
 */
ValidationError.DATA_PATH = '$DATA$';

util.inherits(ValidationError, RequestError);
