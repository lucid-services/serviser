'use strict';

const _            = require('lodash');
const Promise      = require('bluebird');
const EventEmmiter = require('events-bluebird');
const stackTrace   = require('stack-trace');

const RouteError          = require('../error/routeError.js');
const Response            = require('../response.js');
const validatorMiddleware = require('../middleware/validator.js');
const errorHandler        = require('../middleware/errorHandler.js');

module.exports = Route;//aka. RouteInterface


/**
 * @param {Object} options
 * @param {String} [options.name]
 * @param {String} options.url
 * @param {String} options.summary - swagger doc
 * @param {String} options.desc - swagger doc
 * @param {String} options.sdkMethodName - client sdk method name
 *
 * @throws {RouteError}
 * @alias RouteInterface
 * @constructor
 **/
function Route(options) {
    var defaults = {
        name: null,
        url: null,
        summary: "",
        desc: "",
        sdkMethodName: ""
    };

    const route = this;
    this.options = _.assign(defaults, options || {});

    this.steps = [];
    this.description = {
        responses: {},
        summary: this.options.summary,
        description: this.options.desc,
        sdkMethodName: this.options.sdkMethodName
    };
    this.$dataParserMiddleware = null;
    this.$dataParser = null;

    if (!options.url) {
        throw new RouteError('Invalid request url');
    }

    if (!this.description.sdkMethodName) {
        this.description.sdkMethodName = this.$formatUid('{method}{Name}');
    }

    /**
     * unique identifier create on Route initialization
     * @name RouteInterface#uid
     * @instance
     * @type {String}
     */
    this.uid = this.$formatUid(
        this.Router.options.routeNameFormat
    );

    /**
     * tries to guess where the route definition is located
     * @name RouteInterface#fileSystemLocation
     * @instance
     * @type {String}
     */
    this.fileSystemLocation = this.$getFileSystemLocation();
    route.$setSupportedContentTypes();

    this.once('build', pushErrorHandler);
    this.once('build', pushNoop);
};

Route.prototype = Object.create(EventEmmiter.prototype, {
    constructor: Route
});

/**
 * @private
 * @param {Function} fn - parser function will be provided with `req` object
 * @return {RouteInterface} - self
 */
Route.prototype.$setContentTypeParser = function(fn) {
    this.$dataParser = fn;
    return this;
};

/**
 * @private
 * @return {Function|null}
 */
Route.prototype.$getContentTypeParser = function(fn) {
    return this.$dataParser;
};

/**
 * @private
 * @return {undefined}
 */
Route.prototype.$setSupportedContentTypes = function() {
    let bodyParser = this.Router.App.config.get('bodyParser');

    if (!bodyParser) {
        return;
    }

    Object.keys(bodyParser).forEach(function(key) {
        let options = bodyParser[key];
        this.acceptsContentType(options.type || key, options);
    }, this);
};

/**
 * define which content-type headers the route supports
 *
 * @param {String}   type - Content-Type header value
 * @param {Object}   [options]
 * @param {String}   [options.limit] - data size limit
 * @param {Function} [parser] - custom data parser function - must return a Promise
 * @return {RouteInterface}
 */
Route.prototype.acceptsContentType = function(type, options, parser) {

    //Neither get or options http method does have req body
    if (~['get', 'options'].indexOf(this.options.type.toLowerCase())) {
        return this;
    }

    if (this.$dataParserMiddleware === null) {
        this.$dataParserMiddleware = {
            name: 'content-type-parser',
            fn: function() {
                return this.route.$getContentTypeParser().apply(this, arguments);
            },
            contentTypes: {},
            mediaTypes: []
        };

        this.steps.push(this.$dataParserMiddleware);
    }

    if (typeof this.$dataParserMiddleware === 'object'
        && _.isPlainObject(this.$dataParserMiddleware.contentTypes)
        && !this.$dataParserMiddleware.contentTypes.hasOwnProperty(type)
    ) {
        this.$dataParserMiddleware.contentTypes[type] = _.assign(_.clone(options), {
            parser: parser,
            type: type,
        });

        this.$dataParserMiddleware.mediaTypes.push(type);
    }

    return this;
};

/**
 * define a content-type which should be always rejected by this route.
 * Content types black listed by this method can be later white listed by the
 * {@link RouteInterface#acceptsContentType} method
 *
 * @param {String} type - Content-Type header value
 * @return {RouteInterface}
 */
Route.prototype.rejectsContentType = function(type) {
    if (   typeof this.$dataParserMiddleware === 'object'
        && this.$dataParserMiddleware !== null
    ) {
        let index = this.$dataParserMiddleware.mediaTypes.indexOf(type);
        delete this.$dataParserMiddleware.contentTypes[type];
        if (~index) {
            this.$dataParserMiddleware.mediaTypes.splice(index, 1);
        }
    }

    return this;
};

/**
 * should be called by internal code only. Otherwise it will return distorted result
 * @private
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
 * returns route's name. If no name has been assigned,
 * the name is dynamically created from route's url path
 *
 * @abstract
 * @return {String}
 */
Route.prototype.getName = function() {
    throw new Error('Not implemented by subclass');
};

/**
 * @private
 * @abstract
 * @param {String} format
 * @return {String}
 */
Route.prototype.$formatUid = function(format) {
    throw new Error('Not implemented by subclass');
};

/**
 * @example
 * route.main(() => {})
 *
 * //is same as:
 *
 * route.addStep('main', () => {})
 *
 * @param {Function} fn
 * @return {RouteInterface} - self
 */
Route.prototype.main = function(fn) {

    this.steps.push({
        name: 'main',
        fn: fn
    });

    return this;
};

/**
 * pushes specifically configured validation middleware to the route's call stack
 *
 * @example
 *
 * route.validate({
 *     properties: {
 *         username: {type: 'string'}
 *     }
 * }, 'query');
 *
 * //
 *
 * route.validate('ajv-registered-validation-schema-uid', 'body');
 *
 * @param {string|Object} valDef - string => registered validator's name. Object => schema definition
 * @param {string}  dataProp - any of available properties of the `req` object - eg.: query|body|params|headers
 *
 * @return {RouteInterface} - self
 */
Route.prototype.validate = function() {
    var args = Array.prototype.slice.call(arguments, 0);

    //if literal ajv schema is provided make sure that expected data type is set
    //query,body,params,headers are expected to be all objects by default
    if (_.isPlainObject(args[0]) && !args[0].hasOwnProperty('type')) {
        args[0].type = 'object';
    }

    this.steps.push({
        name: 'validator',
        fn: validatorMiddleware.apply(this, _.cloneDeep(args)),
        args: _.cloneDeep(args)
    });

    return this;
};

/**
 * allows to hook up any middleware function to the request promise chain (call stack)
 *
 * @param {String} [name]
 * @param {Function} fn
 * @return {RouteInterface} - self
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
 * alias of {@link RouteInterface#addStep}
 *
 * @function
 * @param {String} [name]
 * @param {Function} fn
 * @return {RouteInterface} - self
 */
Route.prototype.step = Route.prototype.addStep;

/**
 * returns route's internal middleware call stack
 * @returns {Array}
 */
Route.prototype.getAllSteps = function () {
    return this.steps;
};

/**
 * allows to describe route's response data format in form of `Ajv` validation
 * schema definition or `Error` object/constructor which implements `toSwagger` method.  
 * if a `string` is provided it's expected to be validation schema unique indentifier
 * registered with the Ajv instance.  
 * With `res.filter({json: 'data'}).json()` conjuction, data can be filtered
 * with defined response schema.
 *
 * @example
 *
 * route.respondsWith({
 *     type: 'object',
 *     additionalProperties: false,
 *     properties: {
 *         prop1: {type: 'string'}
 *     }
 * });
 *
 * route.main(function(req, res) {
 *     res.filter({prop1: 'included', prop2: 'filtered out'}).json();
 * });
 *
 * @param {Object|String|Function} descriptor
 * @return {RouteInterface} - self
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

    //we support only single schema definition for a "success" response
    if (code === 200 && responses[code].length) {
        responses[code].splice(0, 1, schema);
    } else {
        responses[code].push(schema);
    }

    return this;
};

/**
 * catch promise stack handler invoked when an Error occurs while executing one
 * of the routes` middlwares
 *
 * @example
 * route.main(function() {
 *   throw new TypeError('test');
 * }).catch(TypeError, function(err, req, res) {
 *   //err handler logic
 * });
 *
 * @param {Function} [filter] - must be a constructor with .prototype property that is instanceof Error
 * @param {Function} callback
 *
 * @returns {RouteInterface} - self
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
 * the Response object can be returned from within route middleware - that will
 * cause promise call chain interruption of current request and prioritized response
 *
 * @example
 * route.step(function() {
 *     return route.buildResponse(function() {
 *         this.json({response: 'data'});
 *     }):
 * }).step(function() {
 *     //will never be called
 * });
 *
 * @param {Function} cb - callback function which sets response on the express `res` object. The function's context is always set to the `res` object
 * @return {Response}
 */
Route.prototype.buildResponse = function(cb) {
    return new Response(cb);
};

/**
 * constructs single function which takes req & res & next arguments
 * @return {Function}
 */
Route.prototype.build = function() {

    const self = this;
    this.emit('build');

    return function callback(req, res, next) {

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

        //if a callback function is provided and an unhandled error is
        //encountered, redirect it to the callback function.
        if (typeof next === 'function') {
            return promise.catch(next);
        }
        return promise;
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

//required by the RouteInterface.prototype.build method
function noop() {}

/**
 * @private
 * Route#build event listener
 */
function pushErrorHandler() {
    let app = this.Router.App;

    //add error handler
    this.catch(function(err, req, res) {
        errorHandler.errorHandler.call(app, err, req, res)
    });
}

/**
 * @private
 * Route#build event listener
 */
function pushNoop() {
    //no operation middleware is required as it allows post-processing
    //of fulfillment value of the last middleware
    this.step('noop', noop);
}
