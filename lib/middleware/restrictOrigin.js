'use strict';

var Promise = require('bluebird');

var nodeUrl = require('url');
var debug = require('debug')('restrictOriginMiddleware');
var HttpStatusCodes = require('http-status-codes');
var RequestError = require('../error/requestError.js');

/**
 * @expects req.client
 * @return {Function} - middleware
 */
module.exports = function () {
    return function (req) {

        return new Promise(function (resolve, reject) {
            var domains = req.client && req.client.domains || null;
            var message;

            if (!domains) {
                message = 'Domains must be set';
                debug(message);
                return reject(new RequestError({
                    message: message,
                    code: 400
                }));
            }

            if (!Array.isArray(domains)) {
                domains = [domains];
            }

            var referer;
            var origin = unifyUrl(req.get('Origin'));

            if (!origin) {
                referer = unifyUrl(req.get('Referer'));
            }

            debug('Origin:', origin);
            debug('Referer:', referer);

            if (domains.indexOf(origin || referer) >= 0) {
                debug('Allow: ', origin || referer);
                return resolve();
            } else if (origin || referer) {
                for (var index in domains) {
                    var domain = domains[index];
                    if (domain[0] === '^' && domain[domain.length - 1] === '$') {
                        if ((origin || referer).match(domain)) {
                            debug('Allow: ', origin || referer);
                            return resolve();
                        }
                    }
                }
            }

            message = 'Forbidden';
            debug(message, origin || referer);
            return reject(new RequestError({
                message: message,
                code: HttpStatusCodes.FORBIDDEN
            }));
        });
    };
};

/**
 * Unify URL string
 *
 * @param  {String} url - URL to unify
 * @return {String} - unified URL
 * @private
 */
function unifyUrl(url) {
    var parsedUrl = url && nodeUrl.parse(url);

    if (parsedUrl && parsedUrl.protocol && parsedUrl.host) {
        url = parsedUrl.protocol + '//' + parsedUrl.host;
    }
    return url;
}

module.exports.unifyUrl = unifyUrl;
