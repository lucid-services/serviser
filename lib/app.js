'use strict'

//let _              = require('lodash');
let Express          = require('express');
let Router           = require('./router.js');
var Session          = require('express-session');
var BodyParser       = require('body-parser');
var ExpressValidator = require('json-inspector').getExpressInjector;
var Passport         = require('passport');
var MethodOverride   = require('method-override');
var Flash            = require('connect-flash');

module.exports = App;

/**
 * App
 *
 * @param {Config} config - module
 *
 * @constructor
 **/
function App(config) {
    this.config     = config;
    this.expressApp = Express();
    this.routers    = [];

    //App specific Router
    this.Router = function() {
        Router.apply(this, arguments);
    };
    this.Router.prototype = Object.create(Router.prototype);
    this.Router.prototype.constructor = Router;
    this.Router.prototype.App = this;
};


/**
 * $init
 *
 * @param {AppManager} appManager
 *
 * @return {undefined}
 */
App.prototype.$init = function(appManager) {
    this.appManager = appManager;

    // TOOD initialize session store here
    this.expressApp.use(Flash());

    this.expressApp.use(Passport.initialize());
    this.expressApp.use(Passport.session());

    //this.expressApp.use(domainMiddleware);
    this.expressApp.use(BodyParser.json({limit: '2mb'})); //TODO move to config
    this.expressApp.use(BodyParser.urlencoded({limit: '2mb', extended: false})); //TODO move to config

    //this.expressApp.use(ExpressValidator({
        //customAssertions: customAssertions,
        //definitions     : validatorDefinitions,
        //expressVersion  : parseInt(EXPRESS_VERSION[0])
    //})); // this line must be immediately after express.bodyParser()!

    this.expressApp.set('trust proxy', 'uniquelocal');
    this.expressApp.set('view engine', 'ejs');
    this.expressApp.disable('x-powered-by');

    this.expressApp.use(function(req, res, next) {
        res.removeHeader('server', '*');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods',
                'GET, POST, OPTIONS, PUT, PATCH, DELETE, CONNECT');
        res.setHeader('Access-Control-Allow-Headers',
                'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'deny');
        return next();
    });
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

    this.routers.forEach(function(router) {
        self.expressApp.use(router.getUrl(), router.$buildExpressRouter());
    });
};
