const _                = require('lodash');
const Promise          = require('bluebird');

const ServiceError = require('./error/serviceError.js');

module.exports = ResourceManager;
module.exports.ResourceManager = ResourceManager;

/**
 * @public
 * @constructor
 *
 */
function ResourceManager() {
    this.resources = {};
};


/**
 * @param {String} key
 * @return {mixed}
 */
ResourceManager.prototype.get = function(key) {
    if (!this.resources.hasOwnProperty(key)) {
        throw new Error(`Resource: ${key} not found`);
    }

    return this.resources[key];
};

/**
 * @param {String} key
 * @throws {TypeError}
 * @return {mixed} - registered resource value
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
 * @method
 * @return {mixed}
 */
ResourceManager.prototype.add = ResourceManager.prototype.register;
