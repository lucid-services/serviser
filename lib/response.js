const _  = require('lodash');

const utils           = require('./utils.js');
const ValidationError = require('./error/validationError.js');

const proxyResponsePrototypeProps = {
    send        : true, //signal that method takes data argument as first argument
    json        : true,
    jsonp       : true,
    write       : true,
    status      : false,
    links       : false,
    sendStatus  : false,
    type        : false,
    contentType : false,
    header      : false,
    setHeader   : false,
    set         : false,
    get         : false,
    clearCookie : false,
    cookie      : false
};


module.exports = Response;
module.exports.Response = Response;

/**
 * Error type to be thrown when a response validation error is encountered.
 * Defaults to {@link ValidationError}. Can be updated by the user.
 * @name Response.ValidationError
 * @type {Error}
 */
Response.ValidationError = ValidationError;

/**
 * simple wrapper object holding a callback which sets response headers & data when executed
 *
 * @param {Function} cb - callback function which actually sets response on the (express) `res` object. It's context is always set to the `res` object
 *
 * @constructor
 * @return {Response}
 */
function Response(cb) {
    if (!(this instanceof Response)) {
        return new Response(cb);
    }

    this._fn = cb;
}

/**
 * wraps express `res` object with additional methods
 *
 * @param {Response} res - express res object
 * @param {Route} route
 * @param {Object} [options]
 * @param {Boolean} [options.filter=true]
 * @param {Boolean} [options.setPaginationHeaders=true]
 *
 * @private
 * @return {Response}
 */
Response.wrap = function wrap(res, route, options) {
    options = options || {};

    if (options.filter !== false) {
        res.filter = function(data) {
            return filter.call(this, data, route);
        };
    }

    if (options.setPaginationHeaders !== false) {
        res.setPaginationHeaders = function(options) {
            return setPaginationHeaders.call(this, options, route);
        };
    }

    return res;
};

/**
 * filters received data according to json-inspector schema which has been staticaly
 * set via the `route.respondsWith(schema)`. Returned wrapped response object has
 * a constrain set so it can respond only with the filtered data.
 *
 * @param {mixin} data
 * @param {Route} route
 *
 * @private
 * @throws {ValidationError}
 * @this {Response} - object with express res object as its prototype
 * @return {Object} - wrapper around response object with explicitly set res data
 */
function filter(data, route) {

    var res = this
    ,   statusCode = res.statusCode
    ,   validator = route.Router.App.getValidator()
    ,   schemaId
    ,   schema;

    if (!statusCode) {
        statusCode = 200;
    }

    if (!route.description.responses.hasOwnProperty(statusCode)
        || !route.description.responses[statusCode].length
        || !route.description.responses[statusCode][0].schema
    ) {
        throw new Error(`There is no response data format set for status code: ${statusCode}. Can't filter response data`);
    }

    if (!_.isPlainObject(data) && data && data.toJSON instanceof Function) {
        data = data.toJSON();
    }

    schema = route.description.responses[statusCode][0].schema;

    if (typeof schema === 'string') {
        schemaId = schema;
    } else {
        schemaId = route.uid + '-RES';//req response schema

        if (!validator.getSchema(schemaId)) {
            validator.addSchema(schema, schemaId);
        }
    }

    if (!validator.validate(schemaId, data)) {
        let err = validator.errors.shift();
        if (err && !err.dataPath) {
            err.dataPath = '<response>';
        }
        throw new Response.ValidationError(err);
    }

    return new Proxy(res, {
        get: function(target, name, receiver) {
            if (proxyResponsePrototypeProps.hasOwnProperty(name)) {
                if (proxyResponsePrototypeProps[name]) {
                    return function() {
                        target[name](data);
                        return receiver;
                    };
                }

                return Reflect.get(target, name, receiver);
            }
        }
    });
}

/**
 * @private
 * @param {Object}  options
 * @param {Integer} options.count
 * @param {Integer} options.offset
 * @param {Integer} options.limit
 * @param {String}  [options.offsetAlias] - if set, will be used as query parameter key name
 * @param {String}  [options.limitAlias] - if set, will be used as query parameter key name
 * @param {Route}   route
 * @this {Object}   res
 * return {Object} - res object
 */
function setPaginationHeaders(options, route) {
    options = Object.assign({}, options || {});

    let headerValue = ''
    ,   urlMeta = utils.getPaginationMeta(options)
    ,   res = this;

    Object.keys(urlMeta).forEach(function(rel) {
        const query = getQueryParams(urlMeta[rel] || {});
        let url = route.getAbsoluteUrl(res.req.params, query);
        headerValue += `<${url}>; rel="${rel}", `;
    });

    headerValue = headerValue.substr(0, headerValue.length - 2);

    this.setHeader('Link', headerValue);
    this.setHeader('x-total-count', options.count);

    return this;

    function getQueryParams(data) {
        if (data.hasOwnProperty('limit') && options.limitAlias) {
            data[options.limitAlias] = data.limit;
            delete data.limit;
        }
        if (data.hasOwnProperty('offset') && options.offsetAlias) {
            data[options.offsetAlias] = data.offset;
            delete data.offset;
        }
        return data;
    }
}
