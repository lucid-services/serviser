'use strict';

const _            = require('lodash');
const EventEmmiter = require('events').EventEmitter;

const RouterError = require('../error/routerError.js');

module.exports = Router;


/**
 * emitted with each {@link RouterInterface#buildRoute} method call.
 *
 * @event RouterInterface#build-route
 * @property {Route} route
 */

/**
 * Holds {@link RouteInterface} definition objects which have common part of a url path
 *
 * @param {Object} options
 * @param {String} [options.routeNameFormat] - will be used to format route UID string. Should contain placeholders: `{method}` & `{name}` `{version}`
 * @param {String} [options.version] - will be part of route path
 * @param {String} options.url - relative endpoint
 *
 * @emits RouterInterface#build-route
 * @alias RouterInterface
 * @constructor
 **/
function Router(options) {
    EventEmmiter.call(this);

    var defaults = {
        routeNameFormat: null,
        version: null,
        url: null
    };

    this.routes = [];
    this.options = options = _.assign(defaults, options || {});

    if (!options.url) {
        throw new RouterError('Invalid Router url - got ' + options.url + '');
    }
};

Router.prototype = Object.create(EventEmmiter.prototype);
Router.prototype.constructor = Router;


/**
 * @example
 *     router.setRouteNameFormat('{method}{Name}_{version}');
 * @param {String} format
 * @return {undefined}
 */
Router.prototype.setRouteNameFormat = function(format) {
    this.options.routeNameFormat = format;
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
 * @emits RouterInterface#build-route
 * @return {RouteInterface}
 */
Router.prototype.buildRoute = function(options) {
    var route = new this.Route(options);
    this.emit('build-route', route);
    this.routes.push(route);
    return route;
};
