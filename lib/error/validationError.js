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
 * @extends RequestError
 **/
function ValidationError(context) {
    context = context || {};

    var message = `${context.dataPath || '$DATA$'} ${context.message}`;

    RequestError.call(this, {
        message: message
    });
}

util.inherits(ValidationError, RequestError);
