'use strict';

const _  = require('lodash');
const qs = require('qs');

const RouteI          = require('../common/route.js');
const ServiceError    = require('../error/serviceError.js');
const RouteError      = require('../error/routeError.js');
const ValidationError = require('../error/validationError.js');
const RequestType     = require('./requestType.js');
const Response        = require('./response.js');
const reqBodyParser   = require('../middleware/requestContentType.js');

module.exports = Route;

/**
 * @param {Object} options
 * @param {String} [options.name]
 * @param {String} options.type - see {@link RequestType} enum for available option values
 * @param {String} options.url
 * @param {String} options.summary - swagger doc
 * @param {String} options.desc - swagger doc
 * @param {String} options.sdkMethodName - client sdk method name
 *
 * @throws {RouteError}
 * @extends RouteInterface
 * @constructor
 **/
function Route(options) {
    options = options || {};
    const self = this;

    if (_.values(RequestType).indexOf(options.type) === -1) {
        throw new RouteError('Invalid request method type, got: ' + options.type);
    }

    RouteI.call(this, options);

    this.options.url = this.Router.$normalizeUrl(options.url);

    this.$setContentTypeParser(reqBodyParser);
    //any route can respond with 500 - Service Error
    this.respondsWith(ServiceError);

    this.on('build', function(req, res) {
        //wrap our interface around express res object
        Response.wrap(res, self);
        req.routeUID = this.uid;
    });
};

Route.prototype = Object.create(RouteI.prototype, {
    constructor: Route
});

/**
 * returns hostname relative route endpoint
 *
 * @param {Object} [pathParams]
 * @param {Object} [queryParams]
 *
 * @return {String}
 */
Route.prototype.getUrl = function getUrl(pathParams, queryParams) {
    //we need to normalize the url when Router's url is just '/'
    var url = this.Router.$normalizeUrl(this.Router.getUrl() + this.options.url);

    if (typeof pathParams === 'object' && pathParams !== null) {
        Object.keys(pathParams).forEach(function(name) {
            url = url.replace(`:${name}`, pathParams[name]);
        });
    }

    //remove express-like regex matching part of url segment
    // eg.: /path/:id(\d+) => /path/:id
    url = url.replace(/\(.+\)/, '');

    if (   typeof queryParams === 'object'
        && queryParams !== null
        && Object.keys(queryParams).length
    ) {
        url = url + '?' + qs.stringify(queryParams);
    }

    return url;
};

/**
 * returns absolute route endpoint
 *
 * @param {Object} [pathParams]
 * @param {Object} [queryParams]
 *
 * @return {String}
 */
Route.prototype.getAbsoluteUrl = function getAbsoluteUrl(pathParams, queryParams) {
    return this.Router.App.getHost() + this.getUrl(pathParams, queryParams);
};

/**
 * returns route's name. If no name has been assigned,
 * the name is dynamically created from route's url path
 *
 * @return {String}
 */
Route.prototype.getName = function() {
    if (this.options.name) {
        return this.options.name;
    }

    var name = ''
    ,   url = this.Router.getUrl() + this.options.url
    ,   basePath = this.Router.App.config.get('basePath');

    if (url.indexOf(basePath) === 0) {
        url = url.substr(basePath.length);
    }
    //assign default route uid which we make up from route's endpoint
    url.split('/').forEach(function(segment) {
        var pattern = '^(api|s2s|{version}|v[0-9]+(\.[0-9])*|:[a-zA-Z0-9-_]+)$';
        if (!segment.match(pattern)) {
            name += _.upperFirst(segment.toLowerCase());
        }
    });

    return name;
};

/**
 * @private
 * @param {String} format
 * @return {String}
 */
Route.prototype.$formatUid = function(format) {
    var type    = this.options.type.toLowerCase();
    var name    = this.getName();
    var version = this.Router.$getVersionString();

    if (format.match(/{version}/g) && !version) {
        throw new RouteError('Can not format route UID, expected url version but got: ' + version);
    }

    format = format.replace(/{method}/g, type);
    format = format.replace(/{Method}/g, _.upperFirst(type));
    format = format.replace(/{name}/g, _.lowerFirst(name));
    format = format.replace(/{Name}/g, _.upperFirst(name));
    format = format.replace(/{version}/g, version);

    return format;
};

/**
 * pushes specifically configured validation middleware to the route's call stack
 *
 * @example
 *
 * route.validate({
 *     properties: {
 *         username: {type: 'string'}
 *     }
 * }, query);
 *
 * //
 *
 * route.validate('ajv-registered-validation-schema-uid', 'body');
 *
 * @param {string|Object} valDef - string => registered validator's name. Object => schema definition
 * @param {string}  dataProp - query|body|params|headers
 *
 * @return {Route} - self
 */
Route.prototype.validate = function() {
    const args = Array.prototype.slice.call(arguments, 0);
    this.respondsWith(ValidationError);
    return RouteI.prototype.validate.apply(this, args);
};
