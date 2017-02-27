'use strict';
var _       = require('lodash');
var debug   = require('debug')('clientMiddleware');
var Promise = require('bluebird');

var ServiceError      = require('../error/serviceError.js');
var UnauthorizedError = require('../error/unauthorizedError.js');

/**
 * @param {CouchbaseODM.Model}
 * @return {Function}
 */
module.exports = function(ClientModel) {

    /**
     * @param {Boolean|Function} [clientSecret=false] - if it's function, it should return client secret value
     * @param {Function}         [clientId] - The function is supposed to return a client id
     * @param {Boolean}          [restrictScope=false]
     * @param {Boolean}          [restrictRedirect=true] - validates redicrect_url & redirect_back query parameters
     **/
    return function(options) {

        var defaults = _.assign({
            clientId         : undefined,
            clientSecret     : false,
            restrictScope    : false,
            restrictRedirect : true,
        }, options);

        expressClientMiddleware.defaults = defaults;

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
            , clientId     = null
            , clientSecret = null
            , routeUID     = null;

            //Get req client secret value
            if (typeof opt.clientSecret == "function") {
                clientSecret = opt.clientSecret.apply(this, [req, res]);
            } else if(opt.clientSecret){
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

            return ClientModel.getById(clientId).then(function(client) {
                if (!client) {
                    return Promise.reject(new UnauthorizedError());
                }
                debug('Client: ', client);

                var clientScopes = client.scopes || [];
                var scopePermission = opt.restrictScope && clientScopes.indexOf(routeUID);

                //checko whether the client has access to the endpoint
                if (scopePermission === -1) {
                    debug(`route ${routeUID}: unauthorized request from client ${clientId}`);
                    return Promise.reject(new UnauthorizedError());
                }

                if(  opt.restrictRedirect
                    && (!checkRedirectUrl(req, client, 'redirect_url')
                    || !checkRedirectUrl(req, client, 'redirect_back'))
                ) {
                    return Promise.reject(new UnauthorizedError());
                }

                // Check client secret value if requested
                if( opt.clientSecret && clientSecret != client.clientSecret ) {
                    debug("Client secret does not match", clientSecret, client.clientSecret);
                    return Promise.reject(new UnauthorizedError());
                }

                req.client = client;
                return null;
            });
        };
    }

};

module.exports.getData = getData;
module.exports.checkRedirectUrl = checkRedirectUrl;

/**
 * getData
 *
 * @private
 * @param {Request} req - Express request
 * @param {String}  key - data key
 * @return {String} - data value
 */
function getData(req, key) {
    if (req.method === 'get') {
        return req.query[key]
    } else {
        return req.query[key] || req.body[key];
    }
}

/**
 * checkRedirectUrl
 *
 * @param {Object} req
 * @param {Object} client
 * @param {String} param
 *
 * @return {boolean}
 */
function checkRedirectUrl(req, client, param) {
    var allowedRedirectUrls = client.redirectUrls || [];
    var redirectUrl = req.query[param];

    if (   redirectUrl === undefined
        || redirectUrl === ''
        || redirectUrl === null
        || typeof redirectUrl === 'boolean'
    ) {
        return true;
    }

    if (typeof redirectUrl !== 'string') {
        return false;
    }

    for (var i = 0, len = allowedRedirectUrls.length; i < len; i++) {
        var uri = allowedRedirectUrls[i];
        if (   typeof uri === 'string'
            && redirectUrl.match(uri)
        ) {
            return true;
        }
    }

    return false;
}
