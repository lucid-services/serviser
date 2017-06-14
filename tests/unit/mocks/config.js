module.exports = Config;


/**
 * Config
 *
 */
function Config(data) {
    this.stores = {
        literal: {
            store: data || {}
        }
    };
}


/**
 * get
 *
 * @param {String} key
 *
 * @return {undefined}
 */
Config.prototype.get = function(key) {
    return this.stores.literal.store[key];
};

