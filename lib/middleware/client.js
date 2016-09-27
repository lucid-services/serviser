'use strict';
var debug = require('debug')('clientMiddleware');
var ClientModel = require('bi-client-model');
var couchbaseErrors = require('couchbase').errors;
var RequestParser = require('bidash').express.RequestParser;
var errorFactory = require('bidash').errorFactory;
var HttpStatusCodes = require('http-status-codes');

module.exports = function(bucket, options) {

    var secretRequired = true;
    var restrictScope = true;
    if(options && typeof options.secretRequired === 'boolean'){
        secretRequired = options.secretRequired;
    }
    if(options && typeof options.restrictScope === 'boolean'){
        restrictScope = options.restrictScope;
    }

    return function(req, res) {

        var message;

        try{
            var Client = new ClientModel(bucket);
        }catch(err){
            debug('create client model', err.message, __filename);
            return next(errorFactory.getServiceError('ClientModelError', err.message));
        }

        var routeUID = req.scopeUID;
        var clientId = getData(req, 'client_id');
        var clientSecret = getData(req, 'client_secret');

        return Client.getById(clientId).then(function(client){

            debug('found client:', client.getKey().getId(), __filename);
            debug('routeUID:', routeUID);
            debug('secretRequired:', secretRequired);
            debug('restrictScope:', restrictScope);

            if (secretRequired && (!clientSecret || clientSecret !== client.clientSecret)) {
                message = 'Unauthorized';
                debug('client secret mismatch:', message, __filename);
                return next(errorFactory.getApiError(HttpStatusCodes.UNAUTHORIZED, message));
            }

            if(!restrictScope){
                return next();
            }

            if (!routeUID) {
                message = 'Expected route\'s uid, got ' + typeof routeUID;
                debug(message, __filename);
                return next(errorFactory.getServiceError('ClientError', message));
            }

            if (!Array.isArray(client.scopes)) {
                client.scopes = [];
            }

            var routePermission;

            if (Array.isArray(routeUID)) {
                var permissions = routeUID.filter(function(n) {
                    var route = (typeof n === 'object' ? n.name : n);
                    return client.scopes.indexOf(route) !== -1;
                });

                debug('permissions', permissions, __filename);
                routePermission = permissions.length || -1;
            } else {
                routePermission = client.scopes.indexOf(routeUID);
            }

            if (routePermission === -1) {
                message = 'Permision denied';
                debug(message, 'client:', clientId, 'routeUID:', routeUID, __filename);
                return next(errorFactory.getApiError(HttpStatusCodes.UNAUTHORIZED, message));
            }

            req.client = client;
            return next();

        }).catch(function(err){
            if(err.code === couchbaseErrors.keyNotFound){
                debug('client not found', err.message, __filename);
                message = 'Unauthorized';
                return next(errorFactory.getApiError(HttpStatusCodes.UNAUTHORIZED, message));
            }
            debug('couchbase', err.message, __filename);
            return next(errorFactory.getServiceError('ClientError', err.message));
        });
    };
};

/**
 * getData
 *
 * @param {Request} req - Express request
 * @param {string} key - data key
 * @return {string} - data value
 * @private
 */
function getData(req, key) {
    return RequestParser.getField(key, req);
}

module.exports.getData = getData;
