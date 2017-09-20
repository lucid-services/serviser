'use strict';

var _          = require('lodash');
var Promise    = require('bluebird');
var stackTrace = require('stack-trace');
var qs         = require('qs');
var typeis     = require('type-is');

var ServiceError    = require('../error/serviceError.js');
var RouteError      = require('../error/routeError.js');
var ValidationError = require('../error/validationError.js');
var RequestType     = require('./requestType.js');
var Response        = require('./response.js');
var validatorMiddleware = require('../middleware/validator.js');
var reqBodyParser   = require('../middleware/requestContentType.js');

module.exports = Route;


/**
 * @param {Object} options
 * @param {String} [options.name]
 * @param {String} options.type
 * @param {String} options.url
 * @param {String} options.summary - swagger doc
 * @param {String} options.desc - swagger doc
 * @param {String} options.sdkMethodName - client sdk method name
 *
 * @throws {RouteError}
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
    this.$reqDataParser = null;

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
    this.$setSupportedContentTypes();

    //any route can respond with 500 - Service Error
    this.respondsWith(ServiceError);
};

/**
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
 * returns hostname relative route endpoint
 *
 * @param {Object} [pathParams]
 * @param {Object} [queryParams]
 *
 * @return {String}
 */
Route.prototype.getUrl = function getUrl(pathParams, queryParams) {
    //we need to normalize the url when Router's url is just '/'
    var url = this.Router.$normalizeUrl(this.Router.getUrl() + this.options.url);

    if (typeof pathParams === 'object' && pathParams !== null) {
        Object.keys(pathParams).forEach(function(name) {
            url = url.replace(`:${name}`, pathParams[name]);
        });
    }

    //remove express-like regex matching part of url segment
    // eg.: /path/:id(\d+) => /path/:id
    url = url.replace(/\(.+\)/, '');

    if (typeof queryParams === 'object' && queryParams !== null) {
        url = url + '?' + qs.stringify(queryParams);
    }

    return url;
};

/**
 * @param {String}   type
 * @param {Object}   [options]
 * @param {String}   [options.limit] - data size limit
 * @param {Function} [parser] - custom data parser function
 * @return {Route}
 */
Route.prototype.acceptsContentType = function(type, options, parser) {

    //Neither get or options http method does have req body
    if (~['get', 'options'].indexOf(this.options.type.toLowerCase())) {
        return this;
    }

    if (this.$reqDataParser === null) {
        this.$reqDataParser = {
            name: 'content-type-parser',
            fn: reqBodyParser,
            contentTypes: {},
            mediaTypes: []
        };

        this.steps.push(this.$reqDataParser);
    }

    if (typeof this.$reqDataParser === 'object'
        && _.isPlainObject(this.$reqDataParser.contentTypes)
        && !this.$reqDataParser.contentTypes.hasOwnProperty(type)
    ) {
        this.$reqDataParser.contentTypes[type] = _.assign(_.clone(options), {
            parser: parser,
            type: type,
        });

        this.$reqDataParser.mediaTypes.push(type);
    }

    return this;
};

/**
 * @param {String} type
 * @return {Route}
 */
Route.prototype.rejectsContentType = function(type) {
    if (   typeof this.$reqDataParser === 'object'
        && this.$reqDataParser !== null
    ) {
        let index = this.$reqDataParser.mediaTypes.indexOf(type);
        delete this.$reqDataParser.contentTypes[type];
        if (~index) {
            this.$reqDataParser.mediaTypes.splice(index, 1);
        }
    }

    return this;
};

/**
 * returns absolute route endpoint
 *
 * @param {Object} [pathParams]
 * @param {Object} [queryParams]
 *
 * @return {String}
 */
Route.prototype.getAbsoluteUrl = function getAbsoluteUrl(pathParams, queryParams) {
    return this.Router.App.getHost() + this.getUrl(pathParams, queryParams);
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
 * @return {String}
 */
Route.prototype.getName = function() {
    if (this.options.name) {
        return this.options.name;
    }

    var name = ''
    ,   url = this.Router.getUrl() + this.options.url
    ,   basePath = this.Router.App.config.get('basePath');

    if (url.indexOf(basePath) === 0) {
        url = url.substr(basePath.length);
    }
    //assign default route uid which we make up from route's endpoint
    url.split('/').forEach(function(segment) {
        var pattern = '^(api|s2s|{version}|v[0-9]+(\.[0-9])*|:[a-zA-Z0-9-_]+)$';
        if (!segment.match(pattern)) {
            name += _.upperFirst(segment.toLowerCase());
        }
    });

    return name;
};

/**
 * @private
 * @param {String} format
 * @return {String}
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
 * @example
 * route.main(() => {})
 *
 * //is same as:
 *
 * route.addStep('main', () => {})
 *
 * @param {Function} fn
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
 * @param {string|Object} valDef - string => registered validator's name. Object => schema definition
 * @param {string}  dataProp - query|body|params|headers
 * @param {function} fn
 *
 * @return {Route} - self
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

    this.respondsWith(ValidationError);

    return this;
};

/**
 * allows to hook up any middleware function to the request promise chain
 *
 * @param {String} [name]
 * @param {Function} fn
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

    //we support only single schema definition for a "success" response
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
 * you can return the Response object from within route middleware that will
 * cause promise chain interruption of current request
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

    var self = this;
    var lastStep = this.steps[this.steps.length -1];

    //required. Allows post-processing of fulfillment value of the last middleware
    if (lastStep && lastStep.name !== 'noop') {
        self.addStep('noop', noop);
    }

    return function callback(req, res, next) {
        //wrap our interface around express res object
        res = Response.wrap(res, self);

        //
        req.routeUID = self.uid;

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
        //With combination with `express`, error handler middleware will process
        //the error
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

//required
function noop() {
}
