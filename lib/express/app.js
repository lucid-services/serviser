'use strict';

module.exports = App;

var path             = require('path');
var url              = require('url');
var _                = require('lodash');
var http             = require('http');
var https            = require('https');
var Promise          = require('bluebird');
var EventEmmiter     = require('events-bluebird');
var Express          = require('express');
var BodyParser       = require('body-parser');
var ExpressValidator = require('bi-json-inspector');
var EXPRESS_VERSION  = parseInt(require('express/package.json').version[0]);

var AppStatus               = require('./appStatus.js');
var Router                  = require('./router.js');
var routeNotFoundMiddleware = require('../middleware/routeNotFound');
var errorHandlerMiddleware  = require('../middleware/errorHandler');
var reqContentType          = require('../middleware/requestContentType.js');
var reqIdentityMiddleware   = require('../middleware/requestIdentity.js');
var appStatusCheckMiddleware= require('../middleware/appStatusCheck.js');
var ValidationError         = require('../error/validationError');

/**
 * App
 *
 * @param {AppManager} appManager
 * @param {Config} config - module
 * @param {Object} [options]
 * @param {Object} [options.validator] - json-inspector initialization options
 * @param {String} [options.name] - app's name
 *
 * @constructor
 **/
function App(appManager, config, options) {
    EventEmmiter.call(this);
    var app = this;

    this.config          = config;
    this.appManager      = appManager;
    this.service         = appManager.service;
    this.resourceManager = this.service.resourceManager;
    this.expressApp      = Express();
    this.routers         = [];
    this.routes          = {}; //indexed by its UID
    this.server          = null;
    this.doc             = null; // related documentation server ref
    this.status          = null; // private
    this.statusReason    = null; // private
    this.options         = ( options && _.cloneDeep(options) ) || {};

    if (!this.options.name) {
        throw new Error('App `name` option is mandatory');
    }

    //App specific Router
    this.Router = function() {
        Router.apply(this, arguments);
    };
    this.Router.prototype = Object.create(Router.prototype);
    this.Router.prototype.constructor = Router;
    this.Router.prototype.App = this;

    this.$setStatus(AppStatus.INIT);
    app.$normalizeConfig();
    app.$init();
};

App.prototype = Object.create(EventEmmiter.prototype);
App.prototype.constructor = App;
App.prototype.super = EventEmmiter.prototype;


/**
 * on
 *
 * override event emmiter implementation
 *
 * @param {String} event
 * @return {Boolean}
 */
App.prototype.on = function(event) {
    switch (event) {
        case 'unknown-error':
            if (this.listenerCount(event) >= 1) {
                throw new Error('You can assign only single listener for the event');
            }
            break;
    }

    return this.super.on.apply(this, arguments);
};


/**
 * @return {undefined}
 */
App.prototype.$normalizeConfig = function() {

    // set basePath
    var rootPath = this.config.get('baseUrl') || '';
    var host, protocol;
    if (rootPath) {
        //an url without protocol are not valid according to specs
        if (!rootPath.match(/^http(s)?/)) {
            rootPath = 'http://' + rootPath;
        }
        rootPath = url.parse(rootPath);
        host = rootPath.host;
        protocol = rootPath.protocol;
        rootPath = rootPath.pathname || '';
    }
    //nconf bug workaround - config.set('basePath', 'path') does not work
    this.config.stores.literal.store.basePath = rootPath;
    this.config.stores.literal.store.host = host || '';
    this.config.stores.literal.store.protocol = protocol || '';
};

/**
 * $setStatus
 *
 * @param {String} status - see {AppStatus} enum for available options
 * @param {mixed} reason
 *
 * @return {undefined}
 */
App.prototype.$setStatus = function(status, reason) {
    var app = this;

    process.nextTick(function() {
        if (app.status === AppStatus.ERROR) {
            return;
        }

        app.status = status;
        app.statusReason = reason;
        app.emit('status-changed', status);
    });
};

/**
 * $init
 *
 * @return {undefined}
 */
App.prototype.$init = function() {

    var self = this;
    this.expressApp.locals.getUrl = function getUrl(uid, pathParams, queryParams) {
        return self.getRoute(uid).getUrl(pathParams, queryParams);
    };

    //cache routes, validate route UIDs
    this.on('build-router', function(router) {
        var app = this;

        router.on('build-route', function(route) {
            if (app.routes.hasOwnProperty(route.uid)) {
                throw new Error(`Route uid: ${route.uid} must be unique.`);
            }
            app.routes[route.uid] = route;;
        });
    });

    process.nextTick(function(app) {
        var options = app.options;
        var headers = app.config.get('response:headers') || [];
        var bodyParserOptions = app.config.get('bodyParser') || {};
        var defaultValidatorOptions = {
            failOnFirstErr: true,
            expressVersion: EXPRESS_VERSION,
            validationError: ValidationError
        };

        app.emit('pre-init', app);

        app.use(reqContentType.bind(app));
        Object.keys(bodyParserOptions).forEach(function(method) {
            app.use(BodyParser[method](bodyParserOptions[method]));
        });

        options.validator = _.assign(defaultValidatorOptions, options.validator);
        app.use(ExpressValidator.getExpressInjector(
            _.cloneDeep(options.validator)
        )); // app line must be immediately after express.bodyParser()!

        app.expressApp.set('trust proxy', 'uniquelocal');
        //app.expressApp.set('view engine', 'ejs');
        app.expressApp.disable('x-powered-by');

        if (app.config.get('stopOnError') === true) {
            app.use(appStatusCheckMiddleware.bind(app));
        }

        //generates unique uid for each request
        app.use(reqIdentityMiddleware.bind(app));

        // Set default response headers
        app.use(function(req, res, next) {

            res.removeHeader('server', '*');
            headers.forEach(function(header) {
                res.setHeader.apply(res, header);
            });

            return next();
        });

        // Express global error handling
        app.on('post-build', function(app) {
            app.use('*', routeNotFoundMiddleware.bind(app));
            app.use(errorHandlerMiddleware.bind(app));
        });

        app.on('status-changed', function(status) {
            if (   status === AppStatus.ERROR
                && app.config.get('stopOnError') === true
            ) {
                console.error(`The ${app.options.name} app has stopped processing all requests to prevent any further data damage`);
            }
        });

        //default error response fallback,
        //`error-response` listeners are handled asynchronously in a series
        app.on('error-response', function(err, res) {
            if (!res.headersSent) {
                res.json(err);
            }
        });

        app.emit('post-init', app);
    }, this);
};


/**
 * returns protocol + host url string
 * @return {String}
 */
App.prototype.getHost = function() {
    return `${this.config.get('protocol')}//${this.config.get('host')}`;
};

/**
 * useSession
 *
 * @param {CacheStoreInterface} store
 *
 * @return {CacheStoreInterface}
 */
App.prototype.useSession = function(store) {

    var sessionOpt  = _.cloneDeep(this.config.get('session'));
    sessionOpt.store = store;
    this.use(require('express-session')(sessionOpt));

    return store;
};

/**
 * use
 *
 * @param {String} [endpoint]
 * @param {Function} [callback]
 *
 * @return {undefined}
 */
App.prototype.use = function() {
    var args = Array.prototype.slice.call(arguments, 0);
    return this.expressApp.use.apply(this.expressApp, args);
};


/**
 *
 * @param {String} uid
 *
 * @throws Error - when route is not found
 * @return {Route}
 */
App.prototype.getRoute = function(uid) {
    if (!this.routes.hasOwnProperty(uid)) {
        throw new Error(`Route ${uid} not found`);
    }

    return this.routes[uid];
};

/**
 * buildExpressRouter
 *
 * @return {ExpressRouter}
 */
App.prototype.$buildExpressRouter = function() {
    return Express.Router();
};


/**
 *
 * @param {Integer} defaultValue
 *
 * @return {Integer}
 */
App.prototype.$getTimeoutInterval = function(defaultValue) {
    var timeout = this.config.get('request:timeout');
    if (typeof timeout === 'number') {
        return timeout;
    } else if (typeof defaultValue === 'number') {
        return defaultValue;
    }
    return 0;
};

/**
 * buildRouter
 *
 * @param {Object} options
 * @param {String} [options.public]
 * @param {String} [options.version]
 * @param {String} options.url
 *
 * @return {Router}
 */
App.prototype.buildRouter = function(options) {
    var router = new this.Router(options);
    this.routers.push(router);

    this.emit('build-router', router);
    return router;
};

/**
 * build
 *
 * @return {App}
 */
App.prototype.build = function() {
    var app = this;

    process.nextTick(function() {
        app.emit('pre-build', app);

        app.routers.forEach(function(router) {
            app.expressApp.use(router.getUrl(), router.$buildExpressRouter());
        });

        app.emit('post-build', app);
    });

    return app;
};

/**
 * listen
 *
 * @param {Integer|String} port - or socket
 * @param {String}         [hostname]
 * @param {Integer}        [backlog] - the maximum length of the queue of pending connections. The actual length will be determined by your OS through sysctl settings such as tcp_max_syn_backlog and somaxconn on linux. The default value of this parameter is 511 (not 512).
 * @param {Object}         [options]
 * @param {Boolean}        [options.ssl=false]
 *
 * @return http[s].Server
 */
App.prototype.listen = function() {
    var args = Array.prototype.slice.call(arguments, 0, 3);
    var app = this;
    var options = {
        ssl: false,
        cli: false
    };

    if (app.status === AppStatus.ERROR) {
        throw app.statusReason;
    }

    if (app.server !== null) {
        //if we needed the app to listen on both https and http, we should handle this on system level
        throw new Error('Another Server is already running.');
    }

    if (_.isPlainObject(arguments[arguments.length -1])) {
        options = _.assign(options, arguments[arguments.length -1])
    }

    var protocol = options.ssl ? https : http;

    app.server = protocol.createServer(app.expressApp);
    app.server.setTimeout(this.$getTimeoutInterval(10000));//10s

    app.server.on('error', function(err) {
        app.emit('error', err);
    });
    app.server.on('listening', function() {
        app.$setStatus(AppStatus.OK);
        app.emit('listening', app);
    });

    return app.server.listen.apply(app.server, args);
};
