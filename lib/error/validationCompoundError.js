const util            = require('util');
const ValidationError = require('./validationError.js');
const RequestError    = require('./requestError.js');

module.exports = ValidationCompoundError;

/**
 *
 * @param {Array<Object>} context
 * @param {String}        context.keyword
 * @param {String}        context.dataPath
 * @param {String}        context.schemaPath
 * @param {Object}        context.params
 * @param {Object}        context.parentSchema
 * @param {mixed}         context.data
 * @param {String}        context.message
 * @constructor
 * @extends {ValidationError}
 **/
function ValidationCompoundError(context) {
    context = context || [];

    /**
     * @name ValidationCompoundError#code
     * @instance
     * @readonly
     * @default 400
     */
    RequestError.call(this, {
        apiCode: ValidationError.API_CODE,
        message: 'One or more validation failures have been encountered.'
    });

    /**
     * @name ValidationCompoundError#failures
     * @example
     * [
     *   {
     *     dataPath: '.name',
     *     message: 'should be a string'
     *   }
     * ]
     *
     * @instance
     * @readonly
     * @type {Array<Object>}
     */
    this.failures = context.reduce(function(out, err) {
        out.push({
            dataPath: err.dataPath,
            message: err.message
        });

        return out;
    }, []);

    Object.freeze(this.failures);
}

/**
 * @inheritdoc
 */
ValidationCompoundError.prototype.toSwagger = function toSwagger() {
    const out = ValidationError.prototype.toSwagger.call(this);

    out.schema.properties.failures = {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                dataPath: {type: 'string'},
                message: {type: 'string'}
            }
        }
    };

    return out;
};

/**
 * @inheritdoc
 */
ValidationCompoundError.prototype.toJSON = function toJSON() {
    const out = ValidationError.prototype.toJSON.call(this);
    out.failures = [].concat(this.failures);
    return out;
};

util.inherits(ValidationCompoundError, ValidationError);
