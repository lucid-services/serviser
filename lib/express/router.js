'use strict';

var _            = require('lodash');
var EventEmmiter = require('events').EventEmitter;

var Route       = require('./route.js');
var RouterError = require('../error/routerError.js');

module.exports = Router;

/**
 * Router
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

    this.options.url = this.$normalizeUrl(options.url);

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
 * setRouteNameFormat
 *
 * @param {String} format
 *
 * @return {undefined}
 */
Router.prototype.setRouteNameFormat = function(format) {
    this.options.routeNameFormat = format;
};

/**
 * $normalizeUrl
 *
 * @param {String} url
 *
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
    url = url.replace(/\/\//g, '/');

    return url;
};

/**
 * $getVersionString
 *
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
 * getUrl
 *
 * @return {String}
 */
Router.prototype.getUrl = function() {
    return this.options.url;
};

/**
 * buildRoute
 *
 * build new Route object
 *
 * @param {Object} options
 * @param {String} options.name
 * @param {String} options.type
 * @param {String} options.url
 *
 * @return {Route}
 */
Router.prototype.buildRoute = function(options) {
    var route = new this.Route(options);
    this.emit('build-route', route);
    this.routes.push(route);
    return route;
};

/**
 * $buildExpressRouter
 *
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
