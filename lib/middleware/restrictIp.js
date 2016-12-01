'use strict';

var Promise = require('bluebird');

var debug = require('debug')('restrictIp');
var HttpStatusCodes = require('http-status-codes');
var RequestError = require('../error/requestError.js');

/**
 * @expects req.client
 * @return {Function} - middleware
 */
module.exports = function () {
    return function (req) {
        return new Promise(function (resolve, reject) {

            debug('check ip address');
            var ips = req.client && req.client.ips || null;
            var message;

            if (!ips) {
                message = 'Ip addresses must be set';
                debug(message);
                return reject(new RequestError({
                    message: message,
                    code: 400
                }));
            }

            if (ips && !Array.isArray(ips)) {
                ips = [ips];
            }

            if (ips && ips.indexOf(req.ip) >= 0) {
                debug('Allow ip:', req.ip);
                return resolve();
            }

            message = 'Forbidden';
            debug(message, req.ip);
            return reject(new RequestError({
                message: message,
                code: HttpStatusCodes.FORBIDDEN
            }));
        });
    };
};