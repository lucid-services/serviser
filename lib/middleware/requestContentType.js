const _          = require('lodash');
const typeis     = require('type-is');
const BodyParser = require('body-parser');
const Promise    = require('bluebird');

const RequestError = require('../error/requestError.js');

/**
 * {Route} middleware which validates Content-Type header and parses the request
 * body
 */
module.exports = function requestContentTypeParserMiddleware(req, res) {
    const self = this;
    return Promise.try(function() {
        const type = req.header('content-type');

        let types        = self.route.$reqDataParser.mediaTypes
        ,   mediaType    = typeis.is(type, types)
        ,   contentTypes = self.route.$reqDataParser.contentTypes;


        if (type && mediaType) {
            let method = typeis.is(type, ['json', 'urlencoded', 'text', 'raw'])

            if (method) {
                return parse(method, req, res, contentTypes[mediaType]);
            } else if (   contentTypes.hasOwnProperty(mediaType)
                && typeof contentTypes[mediaType].parser === 'function'
            ) {
                return contentTypes[mediaType].parser(req);
            } else {
                return  Promise.reject(
                    new Error(`No parser defined for content-type: ${type}`)
                );
            }
        } else if (!type
            && ~['get', 'options'].indexOf(req.method.toLowerCase())
        ) {
            return null;
        }

        return Promise.reject(new RequestError(
            `Unsupported Content-Type: ${type}. Supported: ${types.join('|  ')}`
        ));
    });
};

/**
 * body parser promise wrapper
 * @param {String} method
 * @param {Object} options
 * @return Promise
 */
function parse(method, req, res, options) {
    return new Promise(function(resolve, reject) {
        BodyParser[method](options)(req, res, function(err) {
            if (err) {
                return reject(err);
            }

            return resolve();
        });
    });
}
