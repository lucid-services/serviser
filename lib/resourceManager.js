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
    this.tags = {};
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
 * @param {String} key
 * @param {...String} tag
 * @return {undefined}
 */
ResourceManager.prototype.tag = function(key /*, tag1, tag2, ....*/) {
    let tags = Array.prototype.slice.call(arguments, 1);
    for (let i = 0, len = tags.length; i < len; i++) {
        if (!this.tags.hasOwnProperty(tags[i])) {
            this.tags[tags[i]] = [];
        }

        if (this.tags[tags[i]].indexOf(key) === -1) {
            this.tags[tags[i]].push(key);
        }
    }
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
    this.tag(key, key);
    return resource;
};


/**
 * inspects integrity of all registered resources
 * @param {String}  [tag] - resource identifier
 * @param {Object}  [options]
 * @param {String}  [options.mode='include'] - include|exclude
 * @method
 *
 * @return {Promise}
 */
ResourceManager.prototype.inspectIntegrity = Promise.method(function(tag, options) {
    options = options || {mode: 'include'};
    let heap;
    let resources = _getResources.call(this, tag, options);

    heap = _.reduce(resources, function(out, resource, name) {
        out[name] = resource.inspectIntegrity().reflect();
        return out;
    }, {});

    return Promise.props(heap).then(function(results) {
        let err = false;

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

/**
 * @private
 * @param {String} tag
 * @param {Object}  [options]
 * @param {String}  [options.mode='include'] - include|exclude
 * @this {ResourceManager}
 * @return {Object}
 */
function _getResources(tag, options) {
    let resources;
    const self = this;

    if (tag && this.tags[tag]) {
        resources = {};
        if (options.mode === 'exclude') {
            _.reduce(this.resources, function(out, resource, key) {
                if (self.tags[tag].indexOf(key) === -1) {
                    out[key] = resource;
                }
                return out;
            }, resources);
        } else {
            this.tags[tag].forEach(function(resourceKey) {
                resources[resourceKey] = this.get(resourceKey);
            }, this);
        }
    } else {
        resources = this.resources;
    }

    return resources;
}
