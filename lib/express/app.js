'use strict';

var _                = require('lodash');
var http             = require('http');
var https            = require('https');
var Promise          = require('bluebird');
var EventEmmiter     = require('events');
var Express          = require('express');
var Session          = require('express-session');
var BodyParser       = require('body-parser');
var ExpressValidator = require('json-inspector');
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
var appStatusCheckMiddleware= require('../middleware/appStatusCheck.js');
var ValidationError         = require('../error/validationError');

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
    this.server       = null;
    this.sequelize    = null;
    this.couchbaseODM = null;
    this.status       = null;
    this.statusReason = null;
    this.storage      = {
        session: null,
        couchbase: null
    };
    this.models       = models;
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
    var app = this;
    var options = this.options;
    var headers = this.config.get('response:headers') || [];
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

    options.validator = _.assign(defaultValidatorOptions, options.validator);
    this.use(ExpressValidator.getExpressInjector(
        _.cloneDeep(options.validator)
    )); // this line must be immediately after express.bodyParser()!

    this.expressApp.set('trust proxy', 'uniquelocal');
    this.expressApp.set('view engine', 'ejs');
    this.expressApp.disable('x-powered-by');

    if (app.config.get('stopOnError') === true) {
        this.use(appStatusCheckMiddleware.bind(app));
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
            && app.config.get('stopOnError') === true
        ) {
            console.error('This node will stop processing all requests to prevent any further data damage');
        }
    });

    this.emit('post-init', this);
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

    this.storage.session = store;
    var sessionOpt  = _.cloneDeep(this.config.get('session'));
    sessionOpt.store = store;
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
        var opt = this.config.get('postgres') || {};
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
