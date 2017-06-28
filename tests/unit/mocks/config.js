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
 * @return {undefined}
 */
Config.prototype.get = function(key) {
    return this._store[key];
};

