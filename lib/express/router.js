'use strict';

var _            = require('lodash');
var EventEmmiter = require('events').EventEmitter;

var Route       = require('./route.js');
var RouterError = require('../error/routerError.js');

module.exports = Router;

/**
 * Holds Route definition objects which have common part of endpoint
 *
 * @param {Object} options
 * @param {String} [options.routeNameFormat]
 * @param {String} [options.version]
 * @param {String} options.url
 *
 * @constructor
 **/
function Router(options) {
    EventEmmiter.call(this);

    var defaults = {
        routeNameFormat: '{method}{Name}_{version}',
        version: null,
        url: null
    };

    this.routes = [];
    this.options = options = _.assign(defaults, options || {});

    if (!options.url) {
        throw new RouterError('Invalid request url');
    }

    var basePath = this.App.config.get('basePath');
    basePath = (basePath && basePath + '/') || '';
    this.options.url = this.$normalizeUrl(basePath + this.options.url);

    //Router specific Route
    this.Route = function RouterRoute() {
        Route.apply(this, arguments);
    };
    this.Route.prototype = Object.create(Route.prototype);
    this.Route.prototype.constructor = this.Route;
    this.Route.prototype.Router = this;
};

Router.prototype = Object.create(EventEmmiter.prototype);
Router.prototype.constructor = Router;


/**
 * @param {String} format
 * @return {undefined}
 */
Router.prototype.setRouteNameFormat = function(format) {
    this.options.routeNameFormat = format;
};

/**
 * @example
 * router.$normalizeUrl('endpoint//under/{version}');
 * "/endpoint/unser/v1.0"
 *
 * @param {String} url
 * @return {String}
 */
Router.prototype.$normalizeUrl = function(url) {
    if (url[0] !== '/') {
        url = '/' + url;
    }

    if (url[url.length - 1] === '/' && url.length > 1) {
        url = url.substring(0, url.length - 1);
    }

    url = url.replace(/{version}/g, this.$getVersionString());
    url = url.replace(/\/{2,}/g, '/');

    return url;
};

/**
 * @example
 * VERSION   VERSION_STRING
 * 1         "v1.0"
 * 2.1       "v2.1"
 * null      ""
 * @return {String}
 */
Router.prototype.$getVersionString = function() {
    var version = this.options.version;

    if (_.isNil(version)) {
        return '';
    }

    if (typeof version === 'number') {
        version = version.toFixed(1);
    }

    return 'v' + version;
};

/**
 * returns absolute path the router is binded to
 * @return {String}
 */
Router.prototype.getUrl = function() {
    return this.options.url;
};

/**
 * creates new Route object
 *
 * @param {Object} options
 * @param {String} options.name
 * @param {String} options.type
 * @param {String} options.url
 *
 * @emits Router#build-route
 * @return {Route}
 */
Router.prototype.buildRoute = function(options) {
    var route = new this.Route(options);
    this.emit('build-route', route);
    this.routes.push(route);
    return route;
};

/**
 * @return {ExpressRouter}
 */
Router.prototype.$buildExpressRouter = function() {
    var router = this.App.$buildExpressRouter();
    this.routes.forEach(function(route) {
        var fn = route.build();
        router[route.options.type](route.options.url, fn);
    });

    return router;
};
