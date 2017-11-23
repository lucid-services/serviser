const _ = require('lodash');

/**
 * @module Utils
 * @class
 * @public
 */

module.exports.getPaginationMeta = getPaginationMeta;
module.exports.registerCustomKeywords = registerCustomKeywords;
module.exports.resolveSchemaRefs = resolveSchemaRefs;

/**
 * @function getPaginationMeta
 * @memberof Utils
 * @static
 * @example
 * require('bi-service').utils.getPaginationMeta(options)
 * //Although you probably want to use res.setPaginationHeaders(options) method
 * // which sets all response data needed for pagination
 *
 * @param {Object} options
 * @param {Integer} options.limit
 * @param {Integer} options.offset
 * @param {Integer} options.count
 * @return {Object}
 */
function getPaginationMeta(opt) {

    opt = opt || {};

    opt.limit = typeof opt.limit !== 'number' ?
        100 : opt.limit === 0
            ? Infinity : opt.limit;

    opt.offset = typeof opt.offset !== 'number' ? 0 : opt.offset;
    opt.count = typeof opt.count !== 'number' ? 0 : opt.count;

    let out = {
        first: {},
        last: {}
    };

    if (opt.limit !== Infinity) {
        out.first.limit = opt.limit;
        out.last.limit = opt.limit;
    }

    if (opt.offset + opt.limit < opt.count) {
        out.next = {
            offset: opt.offset + opt.limit,
            limit: opt.limit
        };
    }

    if (opt.offset) {
        out.prev = {
            offset: (opt.offset - opt.limit < 0) ? 0 : opt.offset - opt.limit,
            limit: opt.limit
        };
    }

    if (opt.count % opt.limit && parseInt(opt.count / opt.limit)) {
        out.last.offset = opt.count / opt.limit;
    } else {
        out.last.offset = Math.max(0, opt.count - opt.limit);
    }

    return out;
}

/**
 * @function registerCustomKeywords
 * @memberof Utils
 * @static
 * @example
 * require('bi-service').utils.registerCustomKeywords(ajv)
 *
 * @param {Ajv} ajv - validator instance
 * @return {Ajv}
 */
function registerCustomKeywords(ajv) {
    //register $desc - aka. property description keyword
    ajv.addKeyword('$desc', {
        schema: false,
        valid: true,
        metaSchema: {
            type: 'string'
        },
    });

    //$toJSON keyword tries to coerce valid JSON data
    ajv.addKeyword('$toJSON', {
        modifying: true,
        statements: true,
        valid: true,
        metaSchema: {
            type: 'object'
        },
        validate: function(schema, data, parentSchema, dataPath, parentData, prop) {
            if (   typeof data === 'object'
                && data !== null
                && typeof data.toJSON === 'function'
                && parentData
            ) {
                parentData[prop] = data.toJSON();
            }
        }
    });

    return ajv;
}

/**
 * dereferences releative $refs and internal references to other ajv validator schemas
 * @param {Object|Array} val - value
 * @param {Ajv} validator
 * @param {Object|Array} _root - initial value
 * @return {Object}
 */
function resolveSchemaRefs(val, validator, _root) {

    _root = _root || val;
    resolve(val, '', val);
    return val;

    /*
     * @param {mixed} val
     * @param {String|Int} key
     * @param {Object|Array} object
     */
    function resolve(val, key, object) {
        if (_.isPlainObject(val)) {
            if (   val.hasOwnProperty('$ref')
                && typeof val.$ref === 'string'
            ) {

                var resolved;

                if (val.$ref.indexOf('#') === 0) {
                    let path = _.compact(val.$ref.slice(1).split('/'));
                    if (_.has(_root, path)) {
                        resolved = _.cloneDeep(_.get(_root, path));
                        _.set(object, key, resolved);

                    }
                } else if ((resolved = validator.getSchema(val.$ref))) {
                    resolved = _.cloneDeep(resolved.schema);
                    _.set(object, key, resolved);
                }

                do {
                    resolve(resolved, key, object);
                }
                while (   _.isPlainObject(object[key])
                         && object[key].hasOwnProperty('$ref')
                );
            } else {
                _.forOwn(val, resolve);
            }
        } else if (val instanceof Array) {
            val.forEach(resolve);
        }
        //can not return anything because of the lodash.forOwn
    }
}
