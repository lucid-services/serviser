'use strict';
var _            = require('lodash');
var debug        = require('debug')('clientMiddleware');
var request      = require('request-promise');
var Promise      = require('bluebird');
var API_CODES    = require('bi-api-errors').DEPOT;
var BIServiceSDK = require('bi-service-sdk');

var ServiceError      = require('../error/serviceError.js');
var RequestError      = require('../error/requestError.js');
var UnauthorizedError = require('../error/unauthorizedError.js');

//so that we can test it properly
module.exports = function() {
    return module.exports.middleware.apply(this, arguments);
};
module.exports.getData         = getData;
module.exports.normalizeClient = normalizeClient;
module.exports.middleware      = middleware;

/**
 * @param {Boolean|Function} [clientSecret=false] - if it's function, it should return client secret value
 * @param {Function}         [clientId] - The function is supposed to return a client id
 * @param {Boolean}          [restrictScope=false]
 * @param {Array<String>}    [dataDestinations]
 * @param {Object}           depot
 * @param {String}           depot.serviceName
 * @return {Function} - middleware
 **/
function middleware(options) {

    var defaults = _.assign({
        clientId         : undefined,
        clientSecret     : false,
        restrictScope    : false,
        dataDestinations : ['headers', 'query', 'body'],
        depot            : {
            serviceName: null
        },
    }, options);

    expressClientMiddleware.defaults = defaults;

    if (defaults.hasOwnProperty('restrictRedirect')) {
        console.warn('The `restrictRedirect` client middleware option has been removed, use route.restrictClientRedirect()!!!');
    }

    return expressClientMiddleware;

    /**
     * @param {Object} req - express req object
     * @param {Object} res - express response object
     * @this - unique request context object
     */
    function expressClientMiddleware(req, res) {
        var reqContext = this
            , route        = this.route
            , opt          = _.cloneDeep(defaults)
            , depot        = opt.depot
            , depotSDK     = route.Router.App.sdk.privateDepot['v1.0']
            , clientId     = null
            , clientSecret = null
            , routeUID     = null;

        //Get req client secret value
        if (typeof opt.clientSecret == "function") {
            clientSecret = opt.clientSecret.apply(this, [req, res]);
        } else if(opt.clientSecret){
            clientSecret = getData(req, 'client_secret', opt.dataDestinations);
        }

        //Get req client id value
        if (typeof opt.clientId == "function") {
            clientId = opt.clientId.apply(this, [req, res]);
        } else {
            clientId = getData(req, 'client_id', opt.dataDestinations);
        }

        //Check permission to access the route
        if( opt.restrictScope ) {
            routeUID = route.uid;

            if (typeof routeUID !== 'string') {
                var err = new ServiceError('Expected route`s uid, got ' + typeof routeUID);
                return Promise.reject(err);
            }
        }

        debug('Check client credentials: ', {
            requested: opt,
            received: {
                routeUID     : routeUID,
                clientId     : clientId,
                clientSecret : clientSecret
            }
        });

        return depotSDK.getServiceClient(depot.serviceName, clientId)
            .catch(BIServiceSDK.SDKRequestError, function(err) {
                if (err.code == 400
                    && err.apiCode === API_CODES.CLIENT_NOT_FOUND
                ) {
                    return Promise.reject(new UnauthorizedError());
                }
                return Promise.reject(err);
            }).then(function(client) {
                client = typeof client === 'object' && client !== null && client.data;
                debug('Client: ', client);

                if (!_.isPlainObject(client) || client.id !== clientId) {
                    return Promise.reject(new ServiceError({
                        message: 'Got unexpected client data from bi-depot service'
                    }));
                }

                var clientScopes = client.scopes || [];
                var scopePermission = opt.restrictScope && clientScopes.indexOf(routeUID);

                //checko whether the client has access to the endpoint
                if (scopePermission === -1) {
                    debug(`route ${routeUID}: unauthorized request from client ${clientId}`);
                    return Promise.reject(new UnauthorizedError());
                }

                // Check client secret value if requested
                if( opt.clientSecret && clientSecret != client.secret ) {
                    debug("Client secret does not match", clientSecret, client.secret);
                    return Promise.reject(new UnauthorizedError());
                }

                normalizeClient(client);

                debug('Vefification success.');
                req.client = client;
                return null;
            });
    };
}


/**
 * @param {Object} client
 *
 * @return {Object}
 */
function normalizeClient(client) {
    if (_.isPlainObject(client.http_rules)) {
        Object.keys(client.http_rules).forEach(function(key) {
            if (client.http_rules[key] instanceof Array) {
                client.http_rules[key].forEach(function(val, index, arr) {
                    arr.splice(index, 1, new RegExp(val));
                });
            }
        });
    }
}

/**
 * @private
 * @param {Request} req - Express request
 * @param {String}  key - data key
 * @param {Array<String>}  destinations - can include headers|body|query
 *
 * @return {String|undefined} - data value
 */
function getData(req, key, destinations) {
    destinations = destinations || [];
    var bodyDestIndex = destinations.indexOf('body');
    var supportedTargets = ['headers', 'body', 'query'];

    if (bodyDestIndex !== -1 && req.method === 'get') {
        destinations.splice(bodyDestIndex, 1);
    }

    for (var i = 0, data, len = destinations.length; i < len; i++) {
        var target = destinations[i];

        if (!~supportedTargets.indexOf(target)) {
            throw new Error(`Invalid target: ${target}`);
        }
        data = getFromTarget(
            target,
            target === 'headers' ? key.replace(/_/g, '-') : key
        );

        if (data) {
            return data;
        }
    }

    function getFromTarget(target, key) {
        return req[target] && req[target][key];
    }
}
