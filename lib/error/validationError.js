var util         = require('util');
var RequestError = require('./requestError.js');

module.exports = ValidationError;

/**
 * Error UnauthorizedError
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
 **/
function ValidationError(context) {
    context = context || {};

    var message = `${context.dataPath || '$DATA$'} ${context.message}`;

    RequestError.call(this, {
        message: message
    });
}

util.inherits(ValidationError, RequestError);
