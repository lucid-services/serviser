'use strict';

var _                = require('lodash');
var Promise          = require('bluebird');
var EventEmmiter     = require('events');
var Express          = require('express');
var Session          = require('express-session');
var Memcached        = require('connect-memcached')(Session);
var BodyParser       = require('body-parser');
var ExpressValidator = require('json-inspector').getExpressInjector;
var Passport         = require('passport');
var CouchbaseODM     = require('kouchbase-odm');
//var MethodOverride   = require('method-override'); //TODO ?
var Flash            = require('connect-flash');

var AppStatus               = require('./appStatus.js');
var Router                  = require('./router.js');
var CouchbaseCluster        = require('../database/couchbase.js');
var sequelizeBuilder        = require('../database/sequelize.js');
var routeNotFoundMiddleware = require('../middleware/routeNotFound');
var errorHandlerMiddleware  = require('../middleware/errorHandler');

module.exports = App;

/**
 * App
 *
 * @param {Config} config - module
 * @param {Object} models
 * @param {Object} models.odm
 * @param {Object} models.orm
 *
 * @constructor
 **/
function App(config, models) {
    EventEmmiter.call(this);

    this.config       = config;
    this.expressApp   = Express();
    this.routers      = [];
    this.server       = null;
    this.sequelize    = null;
    this.couchbaseODM = null;
    this.storage      = {};
    this.models       = models;

    //App specific Router
    this.Router = function() {
        Router.apply(this, arguments);
    };
    this.Router.prototype = Object.create(Router.prototype);
    this.Router.prototype.constructor = Router;
    this.Router.prototype.App = this;

    this.$setStatus(AppStatus.INIT);
};

App.prototype = Object.create(EventEmmiter.prototype);
App.prototype.constructor = App;


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
        app.status = status;
        app.emit('status', status);
    });
};

/**
 * $init
 *
 * @param {AppManager} appManager
 * @param {Object} [options]
 * @param {Object} [options.validator] - json-inspector initialization options
 *
 * @return {undefined}
 */
App.prototype.$init = function(appManager, options) {
    var app = this;
    options = options || {};
    var headers = this.config.get('response:headers');
    var bodyParserOptions = this.config.get('bodyParser');

    this.emit('pre-init', this);

    this.appManager = appManager;

    // TODO initialize session store here
    this.expressApp.use(Flash());

    this.expressApp.use(Passport.initialize());
    this.expressApp.use(Passport.session());

    //this.expressApp.use(domainMiddleware);
    this.expressApp.use(BodyParser.json(bodyParserOptions.json));
    this.expressApp.use(BodyParser.urlencoded(bodyParserOptions.urlencoded));

    this.expressApp.use(ExpressValidator(
        options.validator
    )); // this line must be immediately after express.bodyParser()!

    this.expressApp.set('trust proxy', 'uniquelocal');
    this.expressApp.set('view engine', 'ejs');
    this.expressApp.disable('x-powered-by');

    // Set default response headers
    this.expressApp.use(function(req, res, next) {

        res.removeHeader('server', '*');
        headers.forEach(function(header) {
            res.setHeader.apply(res, header);
        });

        return next();
    });

    // Express global error handling
    this.on('post-build', function(app) {
        app.expressApp.use('*', routeNotFoundMiddleware.bind(app));
        app.expressApp.use(errorHandlerMiddleware.bind(app));
    });

    this.on('status', function(status) {
        if (   status === AppStatus.ERROR
            && app.config.get('system:stop_on_error') === true
        ) {
            process.exit(1);
        }
    });

    this.emit('post-init', this);
};

/**
 * connectMemcache
 *
 * @param {Memcached} memcache
 *
 * @return {MemcachedStore}
 */
App.prototype.connectMemcache = function(memcache) {
    if (this.storage.memcache !== null) {
        return this.storage.memcache;
    }

    if (!(memcache instanceof Memcached)) {
        var memcacheOpt = this.config.get('memcache');
        this.storage.memcache = new Memcached(memcacheOpt);
    } else {
        this.storage.memcache = memcache;
    }

    var sessionOpt  = _.cloneDeep(this.config.get('session'));
    sessionOpt.store = this.storage.memcache;
    this.expressApp.use(Session(sessionOpt));

    return this.storage.memcache;
};

/**
 * connectCouchbase
 *
 * @param {CouchbaseCluster} couchbaseCluster - custom CouchbaseCluster wrapper object
 * @param {CouchbaseODM} couchbaseODM - instance of CouchbaseODM
 *
 * @return {CouchbaseCluster}
 */
App.prototype.connectCouchbase = function(couchbaseCluster, couchbaseODM) {
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
 * connectSequelize
 *
 * @param {Sequelize} sequelize - instance of Sequelize
 *
 * @return {Sequelize}
 */
App.prototype.connectSequelize = function(sequelize) {
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

    this.emit('pre-build', app);

    this.routers.forEach(function(router) {
        app.expressApp.use(router.getUrl(), router.$buildExpressRouter());
    });

    this.emit('post-build', app);

    return app;
};

/**
 * listen
 *
 * @param {Integer|String} target - socket / port
 *
 * @return {Promise<http.Server>}
 */
App.prototype.listen = function(target) {
    var app = this;

    return new Promise(function(resolve, reject) {
        app.server = app.expressApp.listen(target, function() {
            app.$setStatus(AppStatus.OK);
            return resolve(app.server);
        }).on('error', function(err) {
            return reject(err);
        });
    });
};
