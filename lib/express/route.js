'use strict';

var _         = require('lodash');
var Promise   = require('bluebird');
var Validator = require('json-inspector');

var FulfillmentMiddleware   = require('./middleware.js').FulfillmentMiddleware;
var RejectionMiddleware     = require('./middleware.js').RejectionMiddleware;
var RouteError              = require('../error/routeError.js');
var RequestType             = require('./requestType.js');
var clientMiddlewareBuilder = require('../middleware/client.js');
var restrictIpBuilder = require('../middleware/restrictIp.js');
var restrictOriginBuilder = require('../middleware/restrictOrigin.js');

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
    this.catchStack = [];
    this.stepsDict = {};
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
 * @return {undefined}
 */
Route.prototype.main = function(fn) {

    this.stepsDict.main = fn;
    this.steps.push({
        name: 'main',
        fn: fn
    });
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
 * @return {undefined}
 */
Route.prototype.validate = function() {
    var args = Array.prototype.slice.call(arguments, 0);

    this.stepsDict.validator = fn;
    this.steps.push({
        name: 'validator',
        fn: fn
    });

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
 * @return {undefined}
 */
Route.prototype.restrictByClient = function(options) {
    var fn = this.$clientMiddleware(options);
    this.stepsDict.client = fn;
    this.steps.push({
        name: 'client',
        fn: fn
    });
};

/**
 * restrictByIp
 *
 * @return {undefined}
 */
Route.prototype.restrictByIp = function() {
    var fn = this.$restrictIpMiddleware();
    this.stepsDict.restrictIp = fn;
    this.steps.push({
        name: 'restrictIp',
        fn: fn
    });
};

/**
 * restrictByOrigin
 *
 * @return {undefined}
 */
Route.prototype.restrictByOrigin = function() {
    var fn = this.$restrictOriginMiddleware();
    this.stepsDict.restrictOrigin = fn;
    this.steps.push({
        name: 'restrictOrigin',
        fn: fn
    });
};

/**
 * addStep
 *
 * @param string [name]
 * @param function fn
 */
Route.prototype.addStep = function (name, fn) {
    if (typeof name === 'function') {
        fn = name;
        name = this.steps.length + 1;
    }

    if (this.stepsDict.hasOwnProperty(name)) {
        throw new RouteError('Route`s middleware name must be unique');
    }

    this.stepsDict[name] = fn;
    this.steps.push({
        name: name.toString(),
        fn: fn
    });
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

    lastStep.catch = Array.isArray(lastStep.catch) ? lastStep.catch : [];
    lastStep.catch.push(Array.prototype.slice.call(arguments, 0));

    return this;
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

    return router;

    function callback(req, res, next) {
        var reqContext = {
            route: self,
            app: self.Router.App
        };

        if (!self.steps.length) {
            return Promise.reject(new RouteError(`Route ${self.options.url} not implemented`));
        }

        var promise = Promise.resolve();

        self.steps.forEach(function(step) {
            promise = promise.then(function() {
                return step.fn.call(reqContext, req, res);
            });

            ////integrate with route.catch
            promise = applyCatchList(promise, Array.isArray(step.catch) ? step.catch : []);
        });

        //if we encounter unhandled error,
        //redirect it to the express error handler middleware
        return promise.catch(next);

        function applyCatchList(promise, catchList, index) {
            index = index || 0;

            if (index > catchList.length - 1) {
                return promise;
            }

            var args = catchList[index];
            var cbIndex = 0;

            //bluebird's catch method signature has the following signature:
            //catch(errorFilter, callback)
            //where `errorFilter` is optional argument
            //we want to get proper argument with the callback
            if (args.length > 1 && args[1] instanceof Function) {
                cbIndex = 1;
            }

            var cb = args[cbIndex];

            args[cbIndex] = function(err) {
                return cb(err, req, res);
            }

            promise = promise.catch.apply(promise, args);
            return applyCatchList(promise, catchList, ++index);
        }
    }
};
