exports.Express      = require('express');
exports.AppManager   = require('./lib/appManager.js');
exports.CouchbaseODM = require('kouchbase-odm');
exports.App          = require('./lib/app.js');
exports.Router       = require('./lib/router.js');
exports.Route        = require('./lib/route.js');
exports.RequestType  = require('./lib/requestType.js');
exports.modelLoader  = require('./lib/modelLoader.js');
exports.database    = {
    CouchbaseCluster: require('./lib/database/couchbase.js'),
    sequelizeBuilder: require('./lib/database/sequelize.js')
};
exports.error       = {
    IncompleteDataError: require('./lib/error/incompleteDataError.js'),
    RequestError: require('./lib/error/requestError.js'),
    RouteError: require('./lib/error/routeError.js'),
    ServiceError: require('./lib/error/serviceError.js'),
    UnauthorizedError: require('./lib/error/unauthorizedError.js')
};
