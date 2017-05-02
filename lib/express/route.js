'use strict';

var _          = require('lodash');
var Promise    = require('bluebird');
var Validator  = require('bi-json-inspector');
var stackTrace = require('stack-trace');

var RouteError        = require('../error/routeError.js');
var UnauthorizedError = require('../error/unauthorizedError.js');
var ForbiddenError    = require('../error/forbiddenError.js');
var ValidationError   = require('../error/validationError.js');
var ServiceError      = require('../error/serviceError.js');
var RequestType       = require('./requestType.js');
var Response          = require('./response.js');
var clientMiddleware  = require('../middleware/client.js');

module.exports = Route;


/**
 * Route
 * @param {Object} options
 * @param {String} [options.name]
 * @param {String} options.type
 * @param {String} options.url
 * @param {String} options.summary - swagger doc
 * @param {String} options.desc - swagger doc
 * @param {String} options.sdkMethodName - client sdk method name
 *
 * @constructor
 **/
function Route(options) {
    var defaults = {
        name: null,
        type: null,
        url: null,
        summary: "",
        desc: "",
        sdkMethodName: ""
    };

    this.options = _.assign(defaults, options || {});

    this.steps = [];
    this.description = {
        responses: {},
        summary: this.options.summary,
        description: this.options.desc,
        sdkMethodName: this.options.sdkMethodName
    };

    if (_.values(RequestType).indexOf(options.type) === -1) {
        throw new RouteError('Invalid request method type, got: ' + options.type);
    }

    if (!options.url) {
        throw new RouteError('Invalid request url');
    }

    if (!this.description.sdkMethodName) {
        this.description.sdkMethodName = this.$formatUid('{method}{Name}');
    }

    this.options.url = this.Router.$normalizeUrl(options.url);

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
 * @param {string}  dataProp - query|body|params|headers
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

    this.respondsWith(ValidationError);

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
 * @param {Boolean|Function} [options.clientSecret=false] - if it's function, it should return client secret value
 * @param {Function}         [options.clientId] - The function is supposed to return a client id
 * @param {Boolean}          [options.restrictScope=false]
 *
 * @return {Route} - self
 */
Route.prototype.restrictByClient = function(options) {
    var app       = this.Router.App
    , pkg         = require(app.config.get('root') + '/package.json')
    , appName     = app.options.name
    , serviceName = pkg && pkg.name && appName && `${appName}-${pkg.name}`
    , depot       = _.cloneDeep(app.config.get('services:privateDepot') || {})
    , defaults    = { depot: depot };

    depot.serviceName = serviceName;
    options = _.assign(defaults, options);

    if (   !_.isPlainObject(options.depot)
        || !options.depot.host
        || !options.depot.serviceName
    ) {
        throw new RouteError('Misconfigured `bi-depot` service dependency');
    }

    var args = Array.prototype.slice.call(arguments, 0);
    var fn = clientMiddleware(options);

    this.steps.push({
        name: 'client',
        fn: fn,
        args: _.cloneDeep(args)
    });

    this.respondsWith(UnauthorizedError);

    return this;
};

/**
 * @return {Route} - self
 */
Route.prototype.restrictClientOrigin = function() {
    //before the actuall validation, we must verify that we have enough data
    //especially whether a client is properly configured
    this.steps.push({
        name: 'restrictOrigin',
        fn: function(req) {
            if (!_.get(req.client || {}, ['http_rules', 'origin'], []).length) {
                throw new ServiceError(`Misconfigured client:${req.client.id} Cant verify client Origin.`);
            }
        }
    });

    this.validate(function() {
        var list = (this.req.client && this.req.client.http_rules
            && this.req.client.http_rules.origin) || [];

        var or = list.reduce(function(out, regexp) {
            out.push({$matches: regexp});
            return out;
        }, []);

        return {
            $required: true,
            origin: {
                $is: String,
                $or: or
            }
        };
    }, 'headers', null, {
        validationError: ForbiddenError,
        validationMultiError: ForbiddenError
    });

    //describe possible route's response state
    this.respondsWith(ForbiddenError);
    return this;
};

/**
 * verifies that defined req properties match against client redirect restriction
 * settings (array of regexps)
 *
 * @param {Object} [options]
 * @param {String} [options.target='query']
 * @param {Array<String>} options.properties
 *
 * @return {Route}
 */
Route.prototype.restrictClientRedirect = function(options) {
    options = _.assign({
        target: 'query',
        properties: []
    }, options || {});

    if (!options.properties.length) {
        throw new RouteError('Requires at least one req target property to be defined.');
    }

    //before the actuall validation, we must verify that we have enough data
    //especially whether a client is properly configured
    this.steps.push({
        name: 'restrictClientRedirect',
        fn: function(req) {
            if (!_.get(req.client || {}, ['http_rules', 'redirect'], []).length) {
                throw new ServiceError(`Misconfigured client:${req.client.id} Cant verify redirect properties.`);
            }
        }
    });

    this.validate(function() {
        var list = (this.req.client && this.req.client.http_rules
            && this.req.client.http_rules.redirect) || [];

        var or = list.reduce(function(out, regexp) {
            out.push({$matches: regexp});
            return out;
        }, []);

        var out = { $required: false };

        options.properties.forEach(function(prop) {
            out[prop] = {
                $is: String,
                $or: or
            };
        });

        return out;
    }, options.target, null, {
        validationError: ForbiddenError,
        validationMultiError: ForbiddenError
    });

    //describe possible route's response state
    this.respondsWith(ForbiddenError);
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
 * allows to describe route's response data format in form of json-inspector
 * schema definition or Error object/constructor which implements `toSwagger` method
 *
 * @param {Object|String|Function} descriptor
 *
 * @return {Route} - self
 */
Route.prototype.respondsWith = function(descriptor) {
    var responses = this.description.responses;
    var code = 200;

    if (descriptor instanceof Function
        && Error.prototype.isPrototypeOf(descriptor.prototype)
        || descriptor.prototype instanceof Error
    ) {
        descriptor = new descriptor;
        code = descriptor.code;
    } else if (descriptor instanceof Error) {
        code = descriptor.code;
    }

    //if redpondsWith method is called multiple times with same type of Error,
    //eg.: route.respondsWith(new RequestError({apiCode: 'code1'})
    //     route.respondsWith(new RequestError({apiCode: 'code2'})
    //the two swagger schemas of errors will be merged so that we can show
    //for example all the api codes a route responds with.
    responses[code] = responses[code] || [];
    var schema = { schema: descriptor };

    //multiple schema definitions for a "success" response is prohibited
    if (code === 200 && responses[code].length) {
        responses[code].splice(0, 1, schema);
    } else {
        responses[code].push(schema);
    }

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
 * @return {Function}
 */
Route.prototype.build = function() {

    var self = this;

    //required. Allows post-processing of fulfillment value of the last middleware
    self.addStep('noop', noop);

    return function callback(req, res, next) {
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
                    //promise cancellation feature must be explicitly enabled beforehand
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
    };
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
