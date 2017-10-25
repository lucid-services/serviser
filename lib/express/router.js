'use strict';

const _            = require('lodash');
const EventEmmiter = require('events').EventEmitter;

const Route       = require('./route.js');
const RouterError = require('../error/routerError.js');

module.exports = Router;


/**
 * emitted with each {@link Router#buildRoute} method call.
 *
 * @event Router#build-route
 * @property {Route} route
 */

/**
 * Holds {@link Route} definition objects which have common part of endpoint
 *
 * @param {Object} options
 * @param {String} [options.routeNameFormat] - will be used to format route UID string. Should contain placeholders: `{method}` & `{name}` `{version}`
 * @param {String} [options.version] - will be part of route path
 * @param {String} options.url - relative endpoint
 *
 * @emits Router#build-route
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

    /**
     * Router specific {@link Route} constructor
     * @name Router#Route
     * @instance
     * @type {Function}
     */
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
 * @private
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
 * @private
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
 * creates new {@link Route} object
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
 * @private
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
