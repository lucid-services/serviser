
module.exports.getPaginationMeta = getPaginationMeta;
module.exports.registerCustomKeywords = registerCustomKeywords;

/**
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
