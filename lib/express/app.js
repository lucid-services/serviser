'use strict';

var _                = require('lodash');
var Promise          = require('bluebird');
var EventEmmiter     = require('events');
var Express          = require('express');
var Session          = require('express-session');
var BodyParser       = require('body-parser');
var ExpressValidator = require('json-inspector').getExpressInjector;
var CouchbaseODM     = require('kouchbase-odm');
var Flash            = require('connect-flash');
var EXPRESS_VERSION  = parseInt(require('express/package.json').version[0]);

var AppStatus               = require('./appStatus.js');
var Router                  = require('./router.js');
var CouchbaseCluster        = require('../database/couchbase.js');
var sequelizeBuilder        = require('../database/sequelize.js');
var routeNotFoundMiddleware = require('../middleware/routeNotFound');
var errorHandlerMiddleware  = require('../middleware/errorHandler');
var reqIdentityMiddleware   = require('../middleware/requestIdentity.js');
var ValidationError         = require('../error/validationError');
var applicationStatusCheckMiddleware = require('../middleware/appStatusCheck.js');

module.exports = App;

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
    this.middlewares  = [];
    this.server       = null;
    this.sequelize    = null;
    this.couchbaseODM = null;
    this.storage      = {};
    this.models       = models;
    this.initialized  = false;
    this.options      = ( options && _.cloneDeep(options) ) || {};

    //App specific Router
    this.Router = function() {
        Router.apply(this, arguments);
    };
    this.Router.prototype = Object.create(Router.prototype);
    this.Router.prototype.constructor = Router;
    this.Router.prototype.App = this;

    this.$setStatus(AppStatus.INIT);
    appManager.add(this);

    process.nextTick(function() {
        app.$init();
    });
};

App.prototype = Object.create(EventEmmiter.prototype);
App.prototype.constructor = App;
App.prototype.super = EventEmmiter.prototype;


/**
 * on
 *
 * override event emmiter implementation
 *
 * @return {Boolean}
 */
App.prototype.on = function() {
    var event = arguments[0];
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
 * $setStatus
 *
 * @param {String} status - see {AppStatus} enum for available options
 *
 * @return {undefined}
 */
App.prototype.$setStatus = function(status) {
    var app = this;

    process.nextTick(function() {
        if (status === AppStatus.ERROR) {
            return;
        }
        app.status = status;
        app.emit('status-changed', status);
    });
};

/**
 * $init
 *
 * @return {undefined}
 */
App.prototype.$init = function() {
    var app = this;
    var options = this.options;
    var headers = this.config.get('response:headers');
    var bodyParserOptions = this.config.get('bodyParser') || {};
    var defaultValidatorOptions = {
        failOnFirstErr: true,
        expressVersion: EXPRESS_VERSION,
        validationError: ValidationError
    };

    this.emit('pre-init', this);

    //this.use(domainMiddleware);
    this.use(BodyParser.json(bodyParserOptions.json));
    this.use(BodyParser.urlencoded(bodyParserOptions.urlencoded));

    options.validator = _.merge(defaultValidatorOptions, options.validator);
    this.use(ExpressValidator(
        options.validator
    )); // this line must be immediately after express.bodyParser()!

    this.expressApp.set('trust proxy', 'uniquelocal');
    this.expressApp.set('view engine', 'ejs');
    this.expressApp.disable('x-powered-by');

    if (app.config.get('system:stop_on_error') === true) {
        this.use(applicationStatusCheckMiddleware.bind(app));
    }

    //generates unique uid for each request
    this.use(reqIdentityMiddleware.bind(app));

    // Set default response headers
    this.use(function(req, res, next) {

        res.removeHeader('server', '*');
        headers.forEach(function(header) {
            res.setHeader.apply(res, header);
        });

        return next();
    });

    // Express global error handling
    this.on('post-build', function(app) {
        app.use('*', routeNotFoundMiddleware.bind(app));
        app.use(errorHandlerMiddleware.bind(app));
    });

    this.on('status-changed', function(status) {
        if (   status === AppStatus.ERROR
            && app.config.get('system:stop_on_error') === true
        ) {
            console.error('This node will stop processing all requests to prevent any further data damage');
        }
    });

    this.emit('post-init', this);
    this.initialized = true;
};

/**
 * useSession
 *
 * @param {SessionStore} store
 *
 * @return {SessionStore}
 */
App.prototype.useSession = function(store) {
    if (this.storage.session !== null) {
        return this.storage.session;
    }

    var sessionOpt  = _.cloneDeep(this.config.get('session'));
    sessionOpt.store = this.storage.session;
    this.use(Session(sessionOpt));
    this.use(Flash());

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
    var app = this;
    if (this.storage.couchbase !== null) {
        return this.storage.couchbase;
    }

    if (!(couchbaseCluster instanceof CouchbaseCluster)) {
        var opt = this.config.get('couchbase');
        this.storage.couchbase = new CouchbaseCluster(opt);
    } else {
        this.storage.couchbase = couchbaseCluster;
    }

    if (couchbaseODM instanceof CouchbaseODM) {
        this.couchbaseODM = couchbaseODM;
    }

    this.storage.couchbase.on('error', function(err) {
        app.$setStatus(AppStatus.ERROR);
        app.emit('couchbase-error', err);
        //TODO log err
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
        var opt = this.config.get('postgres');
        opt.dialect = 'postgres';
        this.sequelize = sequelizeBuilder(opt);
    } else {
        this.sequelize = sequelize;
    }

    return this.sequelize;
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
    if (args.length == 1) {
        this.middlewares.push(args);
    }
    this.expressApp.use.apply(this.expressApp, args);
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
            app.on(event, listener);
        });
    });

    return app;
};

/**
 * listen
 *
 * @param {Integer|String} target - socket / port
 * @param {String} [hostname]
 * @param {} [backlog]
 *
 * @return {Promise<http.Server>}
 */
App.prototype.listen = function() {
    var args = Array.prototype.slice.call(arguments, 0, 3);
    var app = this;


    return new Promise(function(resolve, reject) {
        args.push(callback);

        app.server = app.expressApp.listen.apply(app.expressApp, args).on('error', function(err) {
            return reject(err);
        });

        function callback() {
            app.$setStatus(AppStatus.OK);
            return resolve(app.server);
        }
    });
};
