var Promise = require('bluebird');
Promise.config({
    cancellation: true, //used for canceling promise chain in case of early request response
});

try{
    exports.Couchbase    = require('couchbase');
    exports.CouchbaseODM = require('kouchbase-odm');
} catch(e) {
    //muted
}

exports.CLI              = require('./lib/cli');
exports.Express          = require('express');
exports.EXPRESS_VERSION  = parseInt(require('express/package.json').version[0]);
exports.AppManager       = require('./lib/express/appManager.js');
exports.App              = require('./lib/express/app.js');
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

exports.database    = {
    CouchbaseCluster: require('./lib/database/couchbase.js'),
    sequelizeBuilder: require('./lib/database/sequelize.js')
};
exports.error       = {
    IncompleteDataError : require('./lib/error/incompleteDataError.js'),
    RequestError        : require('./lib/error/requestError.js'),
    RouteError          : require('./lib/error/routeError.js'),
    ServiceError        : require('./lib/error/serviceError.js'),
    UnauthorizedError   : require('./lib/error/unauthorizedError.js')
};
