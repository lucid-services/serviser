'use strict';

var _         = require('lodash');
var Promise   = require('bluebird');
var Validator = require('json-inspector');

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
 * build
 *
 * @param {ExpressRouter} router - express native Router object
 *
 * @return {ExpressRouter}
 */
Route.prototype.build = function(router) {

    var self = this;
    router[this.options.type](this.options.url, callback);

    function callback(req, res, next) {
        var reqContext = {
            route: self,
            app: self.Router.App
        };

        return Promise.each(self.steps, function(step) {
            var middleware = step.fn;
            return middleware.call(reqContext, req, res);
        }).catch(next);
    }

    return router;
};
