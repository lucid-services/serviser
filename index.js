const Promise = require('bluebird');
Promise.config({
    cancellation: true, //used for canceling promise chain in case of early request response
});

exports = module.exports = require('./lib/service.js');

exports.Express              = require('express');
exports.EXPRESS_VERSION      = parseInt(require('express/package.json').version[0]);
/**
 * `serviser` npm package version
 * @name Service.VERSION
 * @type {String}
 * @readonly
 */
exports.VERSION = require('./package.json').version;
/**
 * @name Service.AppManager
 * @type {AppManager}
 * @readonly
 */
exports.AppManager = require('./lib/appManager.js');
/**
 * @name Service.App
 * @type {App}
 * @readonly
 */
exports.App = require('./lib/express/app.js');
/**
 * self reference
 * @name Service.Service
 * @type {Service}
 * @readonly
 */
exports.Service = require('./lib/service.js');
/**
 * @name Service.ResourceManager
 * @type {ResourceManager}
 * @readonly
 */
exports.ResourceManager = require('./lib/resourceManager.js');
/**
 * @name Service.RemoteServiceManager
 * @type {RemoteServiceManager}
 * @readonly
 */
exports.RemoteServiceManager = require('./lib/remoteServiceManager.js');
/**
 * @name Service.AppStatus
 * @type {AppStatus}
 * @readonly
 */
exports.AppStatus = require('./lib/common/appStatus.js');
/**
 * @name Service.Response
 * @type {Response}
 * @readonly
 */
exports.Response = require('./lib/response.js');
/**
 * @name Service.Router
 * @type {Router}
 * @readonly
 */
exports.Router = require('./lib/express/router.js');
/**
 * @name Service.Route
 * @type {Route}
 * @readonly
 */
exports.Route = require('./lib/express/route.js');
/**
 * @name Service.RequestType
 * @type {RequestType}
 * @readonly
 */
exports.RequestType = require('./lib/express/requestType.js');
/**
 * @name Service.moduleLoader
 * @type {ModuleLoader}
 * @readonly
 */
exports.moduleLoader = require('./lib/moduleLoader.js');
/**
 * @name Service.utils
 * @type {Utils}
 * @readonly
 */
exports.utils = require('./lib/utils.js');

/**
 * @name Service.common
 * @type {CommonList}
 * @readonly
 */
exports.common = {
    App: require('./lib/common/app.js'),
    Router: require('./lib/common/router.js'),
    Route: require('./lib/common/route.js')
};

/**
 * @typedef CommonList
 * @type {Object}
 * @property {AppInterface}    App
 * @property {RouterInterface} Router
 * @property {RouteInterface}  Route
 */

/**
 * @name Service.error
 * @type {ErrorList}
 * @readonly
 */
exports.error = {
    RouteError              : require('./lib/error/routeError.js'),
    RouterError             : require('./lib/error/routerError.js'),
    RouteNotFoundError      : require('./lib/error/routeNotFoundError.js'),
    RequestError            : require('./lib/error/requestError.js'),
    ServiceError            : require('./lib/error/serviceError.js'),
    ValidationError         : require('./lib/error/validationError.js'),
    ForbiddenError          : require('./lib/error/forbiddenError.js'),
    UnauthorizedError       : require('./lib/error/unauthorizedError.js'),
    ValidationCompoundError : require('./lib/error/validationCompoundError.js')
};

/**
 * @typedef ErrorList
 * @type {Object}
 * @property {RouteError}         RouteError
 * @property {RouteNotFoundError} RouteNotFoundError
 * @property {RequestError}       RequestError
 * @property {ServiceError}       ServiceError
 * @property {ValidationError}    ValidationError
 * @property {ForbiddenError}     ForbiddenError
 * @property {UnauthorizedError}  UnauthorizedError
 * @property {ValidationCompoundError} ValidationCompoundError
 */
