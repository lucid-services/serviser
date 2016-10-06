'use strict';
var Promise           = require('bluebird');
var _                 = require('lodash');
var debug             = require('debug')('clientMiddleware');
var couchbaseErrors   = require('couchbase').errors;
var ServiceError      = require('../error/serviceError.js');
var UnauthorizedError = require('../error/unauthorizedError.js');
var HttpStatusCodes   = require('http-status-codes');

module.exports = function(ClientModel) {

    /**
     * @param {Boolean|Function} [clientSecret=false] - if it's function, it should return client secret value
     * @param {Boolean} [restrictScope=false]
     * @param {Function} [clientId] - if defined, it is supposed to return a client id
     **/
    return function(options) {

        var defaults = {
            clientSecret: false,
            restrictScope: false,
            clientId: undefined,
        };

        return function(req, res) {

            var opt = _.merge({}, defaults, options);

            var clientId = null;
            var clientSecret = null;
            var routeUID = null;

            //Get req client secret value
            if (typeof opt.clientSecret == "function") {
                clientSecret = opt.clientSecret.apply(this, [req, res]);
            } else {
                clientSecret = getData(req, 'client_secret');
            }

            //Get req client id value
            if (typeof opt.clientId == "function") {
                clientId = opt.clientId.apply(this, [req, res]);
            } else {
                clientId = getData(req, 'client_id');
            }

            //Check permission to access the route
            if( opt.restrictScope ) {
                routeUID = req.scopeUID;

                if (!routeUID) {
                    var err = new ServiceError('Expected route`s uid, got ' + typeof routeUID);
                    return Promise.reject(err);
                }
            }

            debug('Check client credentials: ', {
                requested: opt,
                received: {
                    clientId: clientId,
                    clientSecret: clientSecret,
                    routeUID: routeUID
                }
            });

            return ClientModel.findById(clientId).then(function(client) {

                debug('Client: ', client);

                var clientScopes = client.scopes || [];

                // Check route permission
                if (Array.isArray(routeUID)) {
                    var permissions = routeUID.filter(function(n) {
                        return clientScopes.indexOf( (typeof n == 'object' ? n.name : n) ) != -1;
                    });

                    debug('permissions', permissions);
                    var scopePermission = permissions.length || -1;
                } else {
                    var scopePermission = opt.restrictScope && clientScopes.indexOf(routeUID);
                }

                // Check client secret value if requested
                if( opt.clientSecret && clientSecret != client.clientSecret ) {
                    debug("Client secret does not match", clientSecret, client.clientSecret);
                    return Promise.reject(new UnauthorizedError());
                }

                req.client = client;
                return null;
            }).catch(function(err){
                if(err.code === couchbaseErrors.keyNotFound){
                    debug('client not found', err.message);
                    return Promise.reject(new UnauthorizedError());
                }
                debug('couchbase', err.message);
                return Promise.reject(new ServiceError(err.message));
            });
        };
    }

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
    if (req.method === 'get') {
        return req.query[key]
    } else {
        return req.query[key] || req.body[key];
    }
}

module.exports.getData = getData;
