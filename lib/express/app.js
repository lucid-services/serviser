'use strict'

let _                = require('lodash');
let Promise          = require('bluebird');
let EventEmmiter     = require('events');
let Express          = require('express');
let Session          = require('express-session');
let Memcached        = require('connect-memcached')(Session);
let BodyParser       = require('body-parser');
let ExpressValidator = require('json-inspector').getExpressInjector;
let Passport         = require('passport');
let MethodOverride   = require('method-override');
let Flash            = require('connect-flash');

let AppStatus               = require('./appStatus.js');
let Router                  = require('./router.js');
let Couchbase               = require('./database/couchbase.js');
let sequelize               = require('./database/sequelize.js');
let routeNotFoundMiddleware = require('../middleware/routeNotFound');
let errorHandlerMiddleware  = require('../middleware/errorHandler');

module.exports = App;

/**
 * App
 *
 * @param {Config} config - module
 *
 * @constructor
 **/
function App(config) {
    EventEmmiter.call(this);

    this.config      = config;
    this.expressApp  = Express();
    this.server      = null;
    this.routers     = [];
    this.storage     = {};

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
    let self = this;

    process.nextTick(function() {
        self.status = status;
        self.emit('status', status);
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
    let app = this;
    options = options || {};
    let headers = this.config.get('response:headers');
    let bodyParserOptions = this.config.get('bodyParser');

    this.appManager = appManager;

    this.emit('pre-init', this);

    // TOOD initialize session store here
    this.expressApp.use(Flash());

    this.expressApp.use(Passport.initialize());
    this.expressApp.use(Passport.session());

    //this.expressApp.use(domainMiddleware);
    this.expressApp.use(BodyParser.json(bodyParserOptions.json));
    this.expressApp.use(BodyParser.urlencoded(bodyParserOptions.urlencoded));

    this.expressApp.use(ExpressValidator(
        options.validator
    })); // this line must be immediately after express.bodyParser()!

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
 * @return {MemcachedStore}
 */
App.prototype.connectMemcache = function() {
    if (this.storage.memcache !== null) {
        return this.storage.memcache;
    }

    let memcacheOpt = this.config.get('memcache');
    let sessionOpt  = _.cloneDeep(this.config.get('session'));

    this.storage.memcache = new Memcached(memcacheOpt);
    sessionOpt.store = this.storage.memcache;

    this.expressApp.use(Session(sessionOpt));

    return this.storage.memcache;
};

/**
 * connectCouchbase
 *
 * @return {CouchbaseCluster}
 */
App.prototype.connectCouchbase = function() {
    if (this.storage.couchbase !== null) {
        return this.storage.couchbase;
    }

    let opt = this.config.get('couchbase');
    this.storage.couchbase = new Couchbase(opt);

    return this.storage.couchbase;
};

/**
 * connectSequelize
 *
 * @return {Sequelize}
 */
App.prototype.connectSequelize = function() {
    if (this.storage.sequelize !== null) {
        return this.storage.sequelize;
    }

    let opt = this.config.get('postgres');
    opt.dialect = 'postgres';
    this.storage.sequelize = sequelize(opt);

    return this.storage.sequelize;
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
 * @return {Router}
 */
App.prototype.buildRouter = function(options) {
    let router = new this.Router(options);
    this.routers.push(router);

    return router;
};

/**
 * build
 *
 * @return {undefined}
 */
App.prototype.build = function() {
    let self = this;

    this.emit('pre-build', this);

    this.routers.forEach(function(router) {
        self.expressApp.use(router.getUrl(), router.$buildExpressRouter());
    });

    this.emit('post-build', this);
};

/**
 * listen
 *
 * @param {Integer|String} target - socket / port
 *
 * @return {Promise<http.Server>}
 */
App.prototype.listen = function(target) {
    let self = this;

    return new Promise(function(resolve, reject) {
        self.server = self.expressApp.listen(target, function() {
            self.$setStatus(AppStatus.OK);
            return resolve(self.server);
        }).on('error', function(err) {
            return reject(err);
        });
    });
};
