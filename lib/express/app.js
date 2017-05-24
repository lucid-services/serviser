'use strict';

module.exports = App;

var path                = require('path');
var url                 = require('url');
var _                   = require('lodash');
var http                = require('http');
var https               = require('https');
var Promise             = require('bluebird');
var EventEmmiter        = require('events-bluebird');
var Express             = require('express');
var BodyParser          = require('body-parser');
var BIServiceSDK        = require('bi-service-sdk').BIServiceSDK;
var ExpressValidator    = require('bi-json-inspector');
var CacheStoreInterface = require('bi-cache-store-interface').CacheStoreInterface;
var EXPRESS_VERSION     = parseInt(require('express/package.json').version[0]);

var AppStatus               = require('./appStatus.js');
var Router                  = require('./router.js');
var sequelizeBuilder        = require('../database/sequelize.js');
var routeNotFoundMiddleware = require('../middleware/routeNotFound');
var errorHandlerMiddleware  = require('../middleware/errorHandler');
var reqIdentityMiddleware   = require('../middleware/requestIdentity.js');
var appStatusCheckMiddleware= require('../middleware/appStatusCheck.js');
var ValidationError         = require('../error/validationError');

/**
 * App
 *
 * @param {AppManager} appManager
 * @param {Config} config - module
 * @param {Object} models
 * @param {Object} models.odm
 * @param {Object} models.orm
 * @param {Object} [options]
 * @param {Object} [options.validator] - json-inspector initialization options
 * @param {String} [options.name] - app's name
 *
 * @constructor
 **/
function App(appManager, config, models, options) {
    EventEmmiter.call(this);
    var app = this;

    this.config       = config;
    this.appManager   = appManager;
    this.expressApp   = Express();
    this.routers      = [];
    this.sdk          = {}; //map of SDKs
    this.server       = null;
    this.doc          = null; // related documentation server ref
    this.sequelize    = null;
    this.couchbaseODM = null;
    this.status       = null; // private
    this.statusReason = null; // private
    this.storage      = {
        cache     : null,
        session   : null,
        couchbase : null
    };
    this.models       = models;
    this.options      = ( options && _.cloneDeep(options) ) || {};

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

    //set Project root path
    var mainModuleDir = path.dirname(require.main.filename);
    //nconf bug workaround - config.set('root', 'path') does not work
    this.config.stores.literal.store.root = path.resolve(mainModuleDir + '/../');


    // set basePath
    var rootPath = this.config.get('baseUrl') || '';
    if (rootPath) {
        //an url without protocol are not valid according to specs
        if (!rootPath.match(/^http(s)?/)) {
            rootPath = 'http://' + rootPath;
        }
        rootPath = url.parse(rootPath);
        rootPath = rootPath.pathname || '';
    }
    //nconf bug workaround - config.set('basePath', 'path') does not work
    this.config.stores.literal.store.basePath = rootPath;
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

    var uids = [];
    this.on('build-router', function(router) {
        router.on('build-route', function(route) {
            if (~uids.indexOf(route.uid)) {
                throw new Error(`Route uid: ${route.uid} must be unique.`);
            }
            uids.push(route.uid);
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

        //app.use(domainMiddleware);
        app.use(BodyParser.json(bodyParserOptions.json));
        app.use(BodyParser.urlencoded(bodyParserOptions.urlencoded));

        options.validator = _.assign(defaultValidatorOptions, options.validator);
        app.use(ExpressValidator.getExpressInjector(
            _.cloneDeep(options.validator)
        )); // app line must be immediately after express.bodyParser()!

        app.expressApp.set('trust proxy', 'uniquelocal');
        app.expressApp.set('view engine', 'ejs');
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

        app.on('error-response', function(err, res) {
            if (!res.headersSent) {
                res.json(err);
            }
        });

        app.emit('post-init', app);
    }, this);
};

/**
 * @param {CacheStoreInterface} store
 *
 * @return {CacheStoreInterface}
 */
App.prototype.useCacheStore = function(store) {
    if (this.storage.cache !== null) {
        return this.storage.cache;
    } else if (!(store instanceof CacheStoreInterface)) {
        throw new Error('`store` must implement `CacheStoreInterface`');
    }

    this.storage.cache = store;
    return this.storage.cache;
};

/**
 * useSession
 *
 * @param {CacheStoreInterface} store
 *
 * @return {CacheStoreInterface}
 */
App.prototype.useSession = function(store) {
    if (this.storage.session !== null) {
        return this.storage.session;
    }

    this.storage.session = store;
    var sessionOpt  = _.cloneDeep(this.config.get('session'));
    sessionOpt.store = store;
    this.use(require('express-session')(sessionOpt));

    return this.storage.session;
};

/**
 * useCouchbase
 *
 * @param {CouchbaseCluster} couchbaseCluster - custom CouchbaseCluster wrapper object
 * @param {CouchbaseODM} couchbaseODM - instance of CouchbaseODM
 *
 * @return {CouchbaseCluster}
 */
App.prototype.useCouchbase = function(couchbaseCluster, couchbaseODM) {
    var CouchbaseCluster = require('../database/couchbase.js')
    ,   CouchbaseODM     = require('kouchbase-odm')
    ,   app              = this;

    if (this.storage.couchbase !== null) {
        return this.storage.couchbase;
    }

    if (!(couchbaseCluster instanceof CouchbaseCluster)) {
        var opt = this.config.get('storage:couchbase');
        this.storage.couchbase = new CouchbaseCluster(opt);
    } else {
        this.storage.couchbase = couchbaseCluster;
    }

    if (couchbaseODM instanceof CouchbaseODM) {
        this.couchbaseODM = couchbaseODM;
    }

    this.storage.couchbase.on('error', function(err) {
        app.emit('couchbase-error', err);
        app.emit('error', err);
    });

    this.storage.couchbase.on('connect', function(bucket) {
        app.emit('couchbase-connect', bucket);
    });

    return this.storage.couchbase;
};

/**
 * useSequelize
 *
 * @param {Sequelize} sequelize - instance of Sequelize
 *
 * @return {Sequelize}
 */
App.prototype.useSequelize = function(sequelize) {
    if (this.sequelize !== null) {
        return this.sequelize;
    }

    if (!(sequelize instanceof sequelizeBuilder.Sequelize)) {
        var opt = _.cloneDeep(this.config.get('storage:postgres') || {});
        opt.dialect = 'postgres';
        this.sequelize = sequelizeBuilder(opt);
    } else {
        this.sequelize = sequelize;
    }

    return this.sequelize;
};

/**
 * when called with specific BIServiceSDK object, the sdk is connected to the app.
 * Otherwise provided `key` string is looked up in `services` app config section
 * and initialized with provided options object.
 *
 * @param {String}       key - one of the keys from `services` app config section
 * @param {BIServiceSDK} [sdk] - mutually exclusive with the `options` argument, when provided, the sdk is connected to the app
 * @param {Object}       [options] - mutually exclusive with the `sdk` argument, options object is provided to SDK constructor when instantiating a new instance
 *
 * @return {Object} - map of all connected SDK versions of given type
 */
App.prototype.useSDK = function(key, sdk, options) {
    if (_.isPlainObject(sdk) && !options) {
        options = sdk;
        sdk = undefined;
    }

    //Try too lookup required data and connect the SDK
    if (sdk === undefined) {
        sdk = this.config.get('services:' + key);
        if (!sdk) {
            throw new Error(`Cant find config value of "services:${key}"`);
        }

        if (!_.isPlainObject(sdk) || !sdk.npm) {
            throw new Error(`"services:${key}:npm" config option not found. Cant connect sdk.`);
        }

        var sdkVersions = module.require(sdk.npm);

        Object.keys(sdkVersions).forEach(function(version) {
            var opt = _.cloneDeep(options || {});
            opt.baseURL = (sdk.ssl ? 'https://' : 'http://') + sdk.host;

            this.useSDK(key, new sdkVersions[version](opt));
        }, this);

    } else if (!(sdk instanceof BIServiceSDK)) {
        throw new Error('`sdk` argument must be an instance of `BIServiceSDK`');
    } else if (!this.sdk[key] || !this.sdk[key].hasOwnProperty(sdk.version)) {
        if (!this.sdk[key]) {
            this.sdk[key] = {};
        }
        this.sdk[key][sdk.version] = sdk;
    }

    return this.sdk[key];
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
 * buildExpressRouter
 *
 * @return {ExpressRouter}
 */
App.prototype.$buildExpressRouter = function() {
    return Express.Router();
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
 * clone
 *
 * @return {App}
 */
App.prototype.clone = function() {
    var app         = new App(this.appManager, this.config, this.models, this.options);
    var originalApp = this;

    ['pre-init', 'post-init', 'pre-build', 'post-build'].forEach(function(event) {
        originalApp.listeners(event).forEach(function(listener) {
            app.on(event, listener.listener || listener);
        });
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
    app.server.on('error', function(err) {
        app.emit('error', err);
    });
    app.server.on('listening', function() {
        app.$setStatus(AppStatus.OK);
        app.emit('listening', app);
    });

    return app.server.listen.apply(app.server, args);
};
