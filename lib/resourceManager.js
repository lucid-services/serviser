const _                = require('lodash');
const Promise          = require('bluebird');

const ServiceError = require('./error/serviceError.js');

module.exports = ResourceManager;
module.exports.ResourceManager = ResourceManager;

/**
 * A Resource can be any object that implements `inspectIntegrity` method which
 * must return a `Promise`.
 * @public
 * @constructor
 *
 */
function ResourceManager() {
    this.resources = {};
};


/**
 * @param {String} key
 * @return {Object} resource object
 */
ResourceManager.prototype.get = function(key) {
    if (!this.resources.hasOwnProperty(key)) {
        throw new Error(`Resource: ${key} not found`);
    }

    return this.resources[key];
};

/**
 * A Resource can be any object that implements `inspectIntegrity` method which
 * must return a `Promise`.
 * @param {String} key
 * @param {Object} resource
 * @throws {TypeError}
 * @return {Object} - resource object
 */
ResourceManager.prototype.register = function(key, resource) {

    if (   typeof resource !== 'object'
        || resource === null
        || typeof resource.inspectIntegrity !== 'function'
    ) {
        throw new TypeError('The resource must be an object that implements `inspectIntegrity` method');
    }

    this.resources[key] = resource;
    return resource;
};


/**
 * inspects integrity of all registered resources
 * @param {String} [key] - resource identifier
 * @method
 *
 * @return {Promise}
 */
ResourceManager.prototype.inspectIntegrity = Promise.method(function(key) {
    var resources, heap;

    if (key) {
        resources = {};
        resources[key] = this.get(key);
    } else {
        resources = this.resources;
    }

    heap = _.reduce(resources, function(out, resource, name) {
        out[name] = resource.inspectIntegrity().reflect();
        return out;
    }, {});

    return Promise.props(heap).then(function(results) {
        var err = false;

        Object.keys(results).forEach(function(name) {
            if (results[name].isRejected()) {
                err = true;
                results[name] = results[name].reason();

                if (   typeof results[name].toJSON !== 'function'
                    && typeof results[name].toString === 'function'
                ) {
                    results[name] = results[name].toString();
                }
            } else {
                results[name] = results[name].value();
            }
        });

        if (err) {
            return Promise.reject(new ServiceError(results));
        }

        return results;
    });
});

/**
 * @param {String} key
 * @param {Object} resource
 * @method
 * @return {Object} resource object
 */
ResourceManager.prototype.add = ResourceManager.prototype.register;
