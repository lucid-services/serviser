let couchbase    = require('couchbase');
let Promise      = require('bluebird');
let _            = require('lodash');
let ServiceError = require('../error/serviceError.js');

module.exports = CouchbaseCluster;

function CouchbaseCluster(options) {
    this.options = _.cloneDeep(options);

    this.buckets = {};
    this.cluster = new couchbase.Cluster();
}

/**
 * get
 *
 * @param {String} name
 *
 * @return {Bucket}
 */
CouchbaseCluster.prototype.get = function(name) {
    if (!this.buckets[name]) {
        //TODO throw specific error
        throw new ServiceError('The bucket (' + name + ') does not exists in current cluster');
    }

    return this.buckets[name];
};

/**
 * openBucket
 *
 * @param {String} name
 * @param {String} pass
 *
 * @return {Bucket}
 */
CouchbaseCluster.prototype.openBucket = function(name, pass) {
    if (this.buckets[name]) {
        return Promise.resolve(this.buckets[name]);
    }

    return this.$openBucket(name, pass);
};


/**
 * $openBucket
 *
 * @param {String} name
 * @param {String} pass
 *
 * @return {Promise<Bucket>}
 */
CouchbaseCluster.prototype.$openBucket = function(name, pass) {
    let self = this;
    return new Promise(function(resolve, reject) {
        self.buckets[name] = self.cluster.openBucket(name, pass);

        self.buckets[name].on('connect', function() {
            resolve(self.buckets[name]);
        });

        self.buckets[name].on('error', reject);
    });
};
