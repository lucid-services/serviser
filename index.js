var Promise = require('bluebird');
Promise.config({
    cancellation: true, //used for canceling promise chain in case of early request response
});

exports.database = {
    sequelizeBuilder: require('./lib/database/sequelize.js')
};

try{
    exports.Couchbase    = require('couchbase');
    exports.CouchbaseODM = require('kouchbase-odm');
    exports.database.CouchbaseCluster = require('./lib/database/couchbase.js');
} catch(e) {
    //muted
}

exports.Express          = require('express');
exports.EXPRESS_VERSION  = parseInt(require('express/package.json').version[0]);
exports.AppManager       = require('./lib/express/appManager.js');
exports.App              = require('./lib/express/app.js');
exports.AppStatus        = require('./lib/express/appStatus.js');
exports.Response         = require('./lib/express/response.js');
exports.Router           = require('./lib/express/router.js');
exports.Route            = require('./lib/express/route.js');
exports.RequestType      = require('./lib/express/requestType.js');
exports.moduleLoader     = require('./lib/moduleLoader.js');
exports.objectFilter     = require('./lib/objectFilter.js');
exports.serviceIntegrity = require('./lib/serviceIntegrity.js');
exports.staticData       = require('./lib/staticData');

exports.models          = {
    odm: {
        Client: require('./lib/models/odm/client.js')
    }
};

exports.error       = {
    IncompleteDataError : require('./lib/error/incompleteDataError.js'),
    RouteError          : require('./lib/error/routeError.js'),
    RouteNotFoundError  : require('./lib/error/routeNotFoundError.js'),
    RequestError        : require('./lib/error/requestError.js'),
    RouteError          : require('./lib/error/routeError.js'),
    ServiceError        : require('./lib/error/serviceError.js'),
    ValidationError     : require('./lib/error/serviceError.js'),
    UnauthorizedError   : require('./lib/error/unauthorizedError.js')
};
