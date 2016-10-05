'use strict';

let _     = require('lodash');
let Route = require('./route.js');

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
    let defaults = {
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
    this.Route.prototype.constructor = Route;
    this.Route.prototype.Router = this;
};


/**
 * getUrl
 *
 * @return {String}
 */
Router.prototype.getUrl = function() {
    return this.options.string;
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
    let route = new this.Route(options);
    this.routes.push(route);
    return route;
};

/**
 * $buildExpressRouter
 *
 * @return {ExpressRouter}
 */
Router.prototype.$buildExpressRouter = function() {
    let router = this.App.$buildExpressRouter();
    this.routes.forEach(function(route) {
        route.build(router);
    });

    return router;
};
