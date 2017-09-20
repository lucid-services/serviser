const ValidationError = require('../error/validationError.js');

/*
 * @param {string|Object} valDef - string => registered schema id. Object => schema definition
 * @param {string}  dataProp - query|body|params
 * @return {Function}
 * @throws {ValidationError}
 */
module.exports = function(valDef, dataProp) {

    const validator = this.Router.App.getValidator();
    var validate;

    if (typeof valDef === 'object' && valDef !== null) {
        validate = validator.compile(valDef);
    } else {
        validate = validator.getSchema(valDef);
    }

    if (typeof validate !== 'function') {
        throw new Error(`No validator for ${valDef} exists`);
    }

    return function(req, res) {

        if (validate(req[dataProp])) {
            return null;
        }

        throw new ValidationError(validate.errors.shift());
    };
};
