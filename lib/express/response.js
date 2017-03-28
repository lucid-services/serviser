var _             = require('lodash');
var jsonInspector = require('bi-json-inspector');
var express       = require('express');

var proxyResponsePrototypeProps = {
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
    set         : false,
    get         : false,
    clearCookie : false,
    cookie      : false
};


module.exports = Response;
module.exports.Response = Response;

/**
 * simple wrapper holding a function which sets resopnse headers & data when executed
 *
 * @param {Function} cb - callback function which actually sets response on the express `res` object. It's context is always set to the `res` object
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
 *
 * @return {Response}
 */
Response.wrap = function wrap(res, route) {

    res.filter = function(data) {
        return filter.call(this, data, route);
    };

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
 * @throws {ValidationError}
 * @this {Response} - object with express res object as its prototype
 * @return {Object} - wrapper around response object with explicitly set res data
 */
function filter(data, route) {

    var statusCode = this.statusCode;
    if (!statusCode) {
        statusCode = 200;
    }

    if (!route.description.responses.hasOwnProperty(statusCode)
        || !route.description.responses[statusCode].schema
    ) {
        throw new Error(`There is no response data format set for status code: ${statusCode}. Can't filter response data`);
    }

    if (!_.isPlainObject(data) && data && data.toJSON instanceof Function) {
        data = data.toJSON();
    }

    var schema = route.description.responses[statusCode].schema;
    var res = this;

    var validator = new jsonInspector.Validator(schema, {
        required: false,
        filterData: true,
        failOnUnexpectedData: false,
        failOnFirstErr: false,
        nullable: true
    });

    validator.validate(data);

    if (!validator.success) {
        throw validator.error;
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
