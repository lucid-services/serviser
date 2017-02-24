'use strict';

var _          = require('lodash');
var Promise    = require('bluebird');
var Validator  = require('bi-json-inspector');
var stackTrace = require('stack-trace');

var RouteError              = require('../error/routeError.js');
var RequestType             = require('./requestType.js');
var Response                = require('./response.js');
var clientMiddlewareBuilder = require('../middleware/client.js');
var restrictIpBuilder       = require('../middleware/restrictIp.js');
var restrictOriginBuilder   = require('../middleware/restrictOrigin.js');

module.exports = Route;


/**
 * Route
 * @param {Object} options
 * @param {String} [options.name]
 * @param {String} options.type
 * @param {String} options.url
 *
 * @constructor
 **/
function Route(options) {
    var defaults = {
        name: null,
        type: null,
        url: null
    };

    this.steps = [];
    this.description = {
        responses: {}
    };
    this.options = _.assign(defaults, options || {});

    if (_.values(RequestType).indexOf(options.type) === -1) {
        throw new RouteError('Invalid request method type, got: ' + options.type);
    }

    if (!options.url) {
        throw new RouteError('Invalid request url');
    }

    this.options.url = this.Router.$normalizeUrl(options.url);

    var ClientModel = this.Router.App.models.odm.Client;
    this.$clientMiddleware = clientMiddlewareBuilder(ClientModel);
    this.$restrictIpMiddleware = restrictIpBuilder;
    this.$restrictOriginMiddleware = restrictOriginBuilder;

    this.uid = this.$formatUid(
        this.Router.options.routeNameFormat
    );

    this.fileSystemLocation = this.$getFileSystemLocation();
};

/**
 * $getFileSystemLocation
 *
 * should be called by internal code only. Otherwise it will return distorted result
 *
 * @return {String|null}
 */
Route.prototype.$getFileSystemLocation = function() {
    var location = null;

    //Get the file system location of the route definition
    try {
        var trace = stackTrace.get();
        for (var i = 0, path = null, len = trace.length; i < len; i++) {
            path = trace[i].getFileName();
            //pick first path which does not contain "node_modules/" directory
            if (   typeof path === 'string'
                && !path.match(/node_modules\//)
                && path.match(/^\/home\//)
            ) {
                location = path;
                break;
            }
        }
    } catch (e) { /* mute the error */ }

    return location;
};

/**
 * getName
 *
 * returns route's name. If no name has been assigned,
 * the name is dynamically created from route's url path
 *
 * @return {String}
 */
Route.prototype.getName = function() {
    if (this.options.name) {
        return this.options.name;
    }

    var name = '';
    //assign default route uid which we make up from route's endpoint
    var url = this.Router.getUrl().substr(1) + this.options.url;
    url.split('/').forEach(function(segment) {
        var pattern = '^(api|s2s|{version}|v[0-9]+(\.[0-9])*|:[a-zA-Z0-9-_]+)$';
        if (!segment.match(pattern)) {
            name += _.upperFirst(segment.toLowerCase());
        }
    });

    return name;
};


/**
 * $formatUid
 *
 * @param {String} format
 *
 * @return {}
 */
Route.prototype.$formatUid = function(format) {
    var type    = this.options.type.toLowerCase();
    var name    = this.getName();
    var version = this.Router.$getVersionString();

    if (format.match(/{version}/g) && !version) {
        throw new RouteError('Can not format route UID, expected url version but got: ' + version);
    }

    format = format.replace(/{method}/g, type);
    format = format.replace(/{Method}/g, _.upperFirst(type));
    format = format.replace(/{name}/g, _.lowerFirst(name));
    format = format.replace(/{Name}/g, _.upperFirst(name));
    format = format.replace(/{version}/g, version);

    return format;
};


/**
 * main
 *
 * @param {function} fn
 *
 * @return {Route} - self
 */
Route.prototype.main = function(fn) {

    this.steps.push({
        name: 'main',
        fn: fn
    });

    return this;
};

/**
 * validate
 *
 * @param {string|Function|Object} valDef - string => registered validator's name. Funtion => function returning object schema definition. Object => schema definition
 * @param {string}  dataProp - query|body|params
 * @param {Object} [customSchema]
 * @param {Object} [options] - See Validator.validate options for more details
 * @param {function} fn
 *
 * @return {Route} - self
 */
Route.prototype.validate = function() {
    var args = Array.prototype.slice.call(arguments, 0);

    this.steps.push({
        name: 'validator',
        fn: fn,
        args: _.cloneDeep(args)
    });

    return this;

    function fn(req, res) {
        return new Promise(function(resolve, reject) {
            var middleware = Validator.getExpressMiddleware.apply(this, args);
            return middleware(req, res, dummyCallback);

            function dummyCallback(err) {
                if (err) {
                    return reject(err);
                }
                return resolve();
            }
        });
    }
};

/**
 * restrictByClient
 *
 * @param {Object} options
 *
 * @return {Route} - self
 */
Route.prototype.restrictByClient = function(options) {
    var args = Array.prototype.slice.call(arguments, 0);
    var fn = this.$clientMiddleware(options);

    this.steps.push({
        name: 'client',
        fn: fn,
        args: _.cloneDeep(args)
    });

    return this;
};

/**
 * restrictByIp
 *
 * @return {Route} - self
 */
Route.prototype.restrictByIp = function() {
    var fn = this.$restrictIpMiddleware();
    this.steps.push({
        name: 'restrictIp',
        fn: fn
    });

    return this;
};

/**
 * restrictByOrigin
 *
 * @return {Route} - self
 */
Route.prototype.restrictByOrigin = function() {
    var fn = this.$restrictOriginMiddleware();
    this.steps.push({
        name: 'restrictOrigin',
        fn: fn
    });

    return this;
};

/**
 * addStep
 *
 * @param string [name]
 * @param function fn
 *
 * @return {Route} - self
 */
Route.prototype.addStep = function (name, fn) {
    if (typeof name === 'function') {
        fn = name;
        name = this.steps.length + 1;
    }

    if (this.steps.find(step => step.name == name)) {
        throw new RouteError('Route`s middleware name must be unique');
    }

    this.steps.push({
        name: name.toString(),
        fn: fn
    });

    return this;
};

/**
 * getAllSteps
 *
 * @returns {Array}
 */
Route.prototype.getAllSteps = function () {
    return this.steps;
};

/**
 * respondsWith
 *
 * @param {Integer}         [code]
 * @param {Object|Function} schema
 *
 * @return {Route} - self
 */
Route.prototype.respondsWith = function(code, schema) {
    var responses = this.description.responses;
    var codeType = typeof code;

    if (codeType === 'object' && !(code instanceof Number) || codeType === 'function') {
        schema = code;
        code = 200;
    }

    responses[code] = responses[code] || {};
    responses[code].schema = schema;

    return this;
};

/**
 * catch promise stack handler invoked in case of an Error
 *
 * @param {Function} [filter] - must be a constructor with .prototype property that is instanceof Error
 * @param {Function} callback
 *
 * @returns {Route} - self
 */
Route.prototype.catch = function () {
    var lastStep = this.steps[this.steps.length - 1];

    if (!_.isPlainObject(lastStep)) {
        throw new RouteError('Can NOT apply a `catch` error handler middleware at this stage');
    }

    //normalize method arguments
    //bluebird's catch method signature has the following signature:
    //catch(errorFilter, callback)
    //where `errorFilter` is optional argument
    var args = Array.prototype.slice.call(arguments, 0);
    if (args.length < 2) {
        args.unshift(Error);
    }

    lastStep.catch = Array.isArray(lastStep.catch) ? lastStep.catch : [];
    lastStep.catch.push(args);

    return this;
};

/**
 * buildResponse
 *
 * @param {Function} cb - callback function which sets response on the express `res` object. The function's context is always set to the `res` object
 * @return {Response}
 */
Route.prototype.buildResponse = function(cb) {
    return new Response(cb);
};

/**
 * build
 *
 * @param {ExpressRouter} router - express native Router object
 *
 * @return {ExpressRouter}
 */
Route.prototype.build = function(router) {

    var self = this;

    router[this.options.type](this.options.url, callback);

    //required. Allows post-processing of fulfillment value of the last middleware
    self.addStep('noop', noop);

    return router;

    function callback(req, res, next) {
        //wrap our interface around express res object
        res = Response.wrap(res, self);

        //per request unique context object
        var reqContext = Object.create(Object.prototype, {
            route: {
                writable: false,
                value: self
            },
            app: {
                writable: false,
                value: self.Router.App
            }
        });

        if (!self.steps.length) {
            return Promise.reject(new RouteError(`Route ${self.options.url} not implemented`));
        }

        var promise = Promise.resolve();

        self.steps.forEach(function(step) {
            promise = promise.then(function(resCandidate) {
                if (resCandidate instanceof Response) {
                    resCandidate._fn.call(res);
                    //promise cancellation feature must be explicitly enabled
                    return promise.cancel();
                }
                return step.fn.call(reqContext, req, res);
            });

            ////integrate with route.catch
            promise = applyCatchList(promise, req, res, step.catch);
        }, self);

        //if we encounter unhandled error,
        //redirect it to the express error handler middleware
        return promise.catch(next);
    }
};

/**
 * applies collection of catch handler functions to provided Promise object
 *
 * @private
 *
 * @param {Promise} promise - the promise catch functions are going to be applied to
 * @param {Object}  req
 * @param {Object}  res
 * @param {Array}   catchList - array of arrays - each item of array is a pair of [ErrorFilterConstructor,FunctionErrHandler]
 * @return {Promise}
 */
function applyCatchList(promise, req, res, catchList, index) {
    index = index || 0;

    if (   !Array.isArray(catchList)
        || index > catchList.length - 1
        || !Array.isArray(catchList[index])
        || !(catchList[index][1] instanceof Function)
    ) {
        return promise;
    }

    var args = _.clone(catchList[index]);
    var cb = args[1];

    args[1] = function(err) {
        return cb(err, req, res);
    };

    promise = promise.catch.apply(promise, args);
    return applyCatchList(promise, req, res, catchList, ++index);
}

//required
function noop() {
}
