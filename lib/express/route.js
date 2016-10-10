'use strict';

var _         = require('lodash');
var Promise   = require('bluebird');
var Validator = require('json-inspector');

var RouteError              = require('../error/routeError.js');
var RequestType             = require('./requestType.js');
var clientMiddlewareBuilder = require('../middleware/client.js');

var validatorMiddleware = Validator.getExpressMiddleware;

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

    options.url = this.Router.$normalizeUrl(options.url);

    var ClientModel = this.Router.App.models.odm.Client;
    this.$clientMiddleware = clientMiddlewareBuilder(ClientModel);

    this.uid = this.buildUid();

};


/**
 * buildUid
 *
 * @return {String}
 */
Route.prototype.buildUid = function() {
    var options = this.options;
    var uid = options.type.toLowerCase();

    if (options.name) {
        uid += _.upperFirst(options.name);
    } else {
        //assign default route uid which we make up from route's endpoint
        var url = this.Router.options.url.substr(1) + this.options.url;
        url.split('/').forEach(function(segment) {
            var pattern = '^(api|s2s|{version}|v[0-9]+(\.[0-9])*|:[a-zA-Z0-9-_]+)$';
            if (!segment.match(pattern)) {
                uid += _.upperFirst(segment.toLowerCase());
            }
        });
    }

    if (!this.Router.options.public) {
        uid += '_s2s';
    }

    if (!this.Router.options.version) {
        uid += '_v' + this.Router.options.version;
    }

    return uid;
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
 * validator
 *
 * @param {string|Function|Object} valDef - string => registered validator's name. Funtion => function returning object schema definition. Object => schema definition
 * @param {string}  dataProp - query|body|params
 * @param {Object} [customSchema]
 * @param {Object} [options] - See Validator.validate options for more details
 * @param {function} fn
 *
 * @return {undefined}
 */
Route.prototype.validator = function() {
    var args = Array.prototype.slice.call(arguments, 0);

    this.stepsDict.validator = fn;
    this.steps.push({
        name: 'validator',
        fn: fn
    });

    function fn(req, res) {
        return validatorMiddleware.apply(this, args)(req, res, dummyCallback);
    }

    function dummyCallback(err) {
        if (err) {
            return Promise.reject(err);
        }
        return Promise.resolve();
    }
};

/**
 * client
 *
 * @param {Object} options
 *
 * @return {undefined}
 */
Route.prototype.client = function(options) {
    var fn = this.$clientMiddleware(options);
    this.stepsDict.client = fn;
    this.steps.push({
        name: 'client',
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
        name: name,
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
            return middleware.call(reqContext, req, res, dummyNext);
        }).asCallback(next);
    }

    function dummyNext(err) {
        if (err) {
            return Promise.reject(err);
        }
        return null;
    };

    return router;
};
