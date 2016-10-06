'use strict';

var _            = require('lodash');
var EventEmmiter = require('events');

var Route = require('./route.js');

module.exports = Router;

/**
 * Router
 * @param {Object} options
 * @param {String} [options.public]
 * @param {String} [options.version]
 * @param {String} options.url
 *
 * @constructor
 **/
function Router(options) {
    EventEmmiter.call(this);

    var defaults = {
        public: false,
        version: null,
        url: null
    };

    this.routes = [];
    this.options = _.assign(options || {}, defaults);

    //Router specific Route
    this.Route = function() {
        Route.apply(this, arguments);
    };
    this.Route.prototype = Object.create(Route.prototype);
    this.Route.prototype.constructor = this.Route;
    this.Route.prototype.Router = this;
};

Router.prototype = Object.create(EventEmmiter.prototype);
Router.prototype.constructor = Router;


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
        route.build(router);
    });

    return router;
};
