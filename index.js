var Promise = require('bluebird');
Promise.config({
    cancellation: true, //used for canceling promise chain in case of early request response
});

exports = module.exports = require('./lib/service.js');

exports.database = {
    CouchbaseCluster: require('./lib/database/couchbase.js')
};

exports.Express              = require('express');
exports.EXPRESS_VERSION      = parseInt(require('express/package.json').version[0]);
exports.VERSION              = require('./package.json').version;
exports.AppManager           = require('./lib/express/appManager.js');
exports.App                  = require('./lib/express/app.js');
exports.Service              = require('./lib/service.js');
exports.ResourceManager      = require('./lib/resourceManager.js');
exports.RemoteServiceManager = require('./lib/remoteServiceManager.js');
exports.AppStatus            = require('./lib/express/appStatus.js');
exports.Response             = require('./lib/express/response.js');
exports.Router               = require('./lib/express/router.js');
exports.Route                = require('./lib/express/route.js');
exports.RequestType          = require('./lib/express/requestType.js');
exports.moduleLoader         = require('./lib/moduleLoader.js');

exports.error       = {
    IncompleteDataError : require('./lib/error/incompleteDataError.js'),
    RouteError          : require('./lib/error/routeError.js'),
    RouteNotFoundError  : require('./lib/error/routeNotFoundError.js'),
    RequestError        : require('./lib/error/requestError.js'),
    RouteError          : require('./lib/error/routeError.js'),
    ServiceError        : require('./lib/error/serviceError.js'),
    ValidationError     : require('./lib/error/validationError.js'),
    ForbiddenError      : require('./lib/error/forbiddenError.js'),
    UnauthorizedError   : require('./lib/error/unauthorizedError.js')
};
