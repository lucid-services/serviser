'use strict';

const RouterI = require('../common/router.js');
const Route   = require('./route.js');

module.exports = Router;


/**
 * emitted with each {@link Router#buildRoute} method call.
 *
 * @event Router#build-route
 * @property {Route} route
 */

/**
 * Holds {@link Route} definition objects which have common part of a url path
 *
 * @param {Object} options
 * @param {String} [options.routeNameFormat] - will be used to format route UID string. Should contain placeholders: `{method}` & `{name}` `{version}`
 * @param {String} [options.version] - will be part of route path
 * @param {String} options.url - relative endpoint
 *
 * @emits Router#build-route
 * @extends RouterInterface
 * @constructor
 **/
function Router(options) {
    options = options || {};

    if (!options.routeNameFormat || typeof options.routeNameFormat !== 'string') {
        options.routeNameFormat = '{method}{Name}_{version}';
    }

    RouterI.call(this, options);

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

Router.prototype = Object.create(RouterI.prototype);
Router.prototype.constructor = Router;

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
