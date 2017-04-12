'use strict';
var _          = require('lodash');
var debug      = require('debug')('clientMiddleware');
var request    = require('request-promise');
var Promise    = require('bluebird');
var API_CODES  = require('bi-api-errors').DEPOT;

var ServiceError      = require('../error/serviceError.js');
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
 * @param {Boolean}          depot.ssl
 * @param {String}           depot.host
 * @param {String}           depot.serviceName
 * @return {Function} - middleware
 **/
function middleware(options) {

    var defaults = _.assign({
        clientId         : undefined,
        clientSecret     : false,
        restrictScope    : false,
        dataDestinations : ['headers', 'body', 'query'],
        depot            : {
            ssl: false,
            serviceName: null,
            host: null
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
            , session      = route.Router.App.storage.session
            , uri          = `${(depot.ssl ? 'https' : 'http')}://${depot.host}/api/v1.0/services/${depot.serviceName}/clients/`
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

            if (!routeUID) {
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

        return (session ? getCachedClient(uri, clientId, session.client) : getClient(uri, clientId)).then(function(client) {
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
 * @param {String} url
 * @param {String} clientId
 *
 * @return {Promise<Object>}
 */
function getClient(url, clientId) {
    return request.get({
        uri: url + clientId,
        json: true,
        simple: true
    }).catch(function(reason) {
        if (reason.response.statusCode == 400
            && _.isPlainObject(reason.error)
            && reason.error.api_code == API_CODES.CLIENT_NOT_FOUND
        ) {
            return Promise.reject(new UnauthorizedError());
        }
        return Promise.reject(reason);
    });
}


/**
 * @param {String} url
 * @param {String} clientId
 * @param {Memcached} memcached
 *
 * @return {Promise<Object>}
 */
function getCachedClient(url, clientId, memcached) {

    return Promise.promisify(memcached.get, {
        context: memcached
    })(url + clientId).then(function(data) {
        if (!data) {
            return getClient(url, clientId).then(function(data) {
                return Promise.promisify(memcached.set, {
                    context: memcached
                })(url + clientId, data, 0).return(data);
            });
        }

        return data;
    });
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
        data = getFromTarget(target);

        if (data) {
            return data;
        }
    }

    function getFromTarget(target) {
        return req[target] && req[target][key];
    }
}
