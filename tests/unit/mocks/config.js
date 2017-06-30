var _ = require('lodash');

module.exports = Config;


/**
 * Config
 *
 */
function Config(data) {
    var store = data || {};

    this.stores = {
        literal: {
            store: store
        }
    };

    this.nconf = {
        stores: {
            defaults: {
                store: store
            }
        }
    };

    this._store = store;
}


/**
 * get
 *
 * @param {String} key
 *
 * @return {mixed}
 */
Config.prototype.get = function(key) {
    var keys = (key || '').split(':');
    return _.get(this._store, keys);
};

/**
 * getOrFail
 *
 * @param {String} key
 *
 * @return {mixed}
 */
Config.prototype.getOrFail = function(key) {
    var keys = (key || '').split(':');
    var val = _.get(this._store, keys);
    if (val === undefined) {
        throw new Error(`Cant find config value of "${key}"`);
    }
    return val;
};

/**
 * @param {Object} data
 *
 * @return {Config}
 */
Config.prototype.createLiteralProvider = function(data) {
    return new Config(data);
};
