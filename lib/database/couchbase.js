var couchbase    = require('couchbase');
var Promise      = require('bluebird');
var _            = require('lodash');
var ServiceError = require('../error/serviceError.js');
var EventEmmiter = require('events');

module.exports = CouchbaseCluster;

/**
 * CouchbaseCluster
 *
 * @param {Object} options
 * @param {String} options.host - string with host(s)
 * @param {Object} options.buckets
 * @param {Object} options.buckets.NAME
 * @param {String} options.buckets.NAME.bucket - bucket's name
 *
 **/
function CouchbaseCluster(options) {
    EventEmmiter.call(this);

    this.options = _.cloneDeep(options);

    this.buckets = {};
    this.cluster = new couchbase.Cluster(options.host);
}

CouchbaseCluster.prototype = Object.create(EventEmmiter.prototype);
CouchbaseCluster.prototype.constructor = CouchbaseCluster;

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
        throw new ServiceError('The bucket (' + name + ') does not exists');
    }

    return this.buckets[name];
};

/**
 * openBucketSync
 *
 * @param {String} name
 *
 * @return {Bucket}
 */
CouchbaseCluster.prototype.openBucketSync = function(name) {
    if (this.buckets[name]) {
        return this.buckets[name];
    }
    if (!this.options.buckets.hasOwnProperty(name)) {
        throw new Error('There is no config record for the bucket: ' + name);
    }

    return this.$openBucketSync(this.options.buckets[name]);
};

/**
 * openBucket
 *
 * @param {String} name
 *
 * @return {Promise<Bucket>}
 */
CouchbaseCluster.prototype.openBucket = function(name) {
    if (this.buckets[name]) {
        return Promise.resolve(this.buckets[name]);
    }
    if (!this.options.buckets.hasOwnProperty(name)) {
        return Promise.reject(new Error('There is no config record for the bucket: ' + name));
    }

    return this.$openBucket(this.options.buckets[name]);
};

/**
 * $openBucketSync
 *
 * @param {Object} options
 * @param {String} options.bucket
 * @param {String} options.password
 *
 * @return {Bucket}
 */
CouchbaseCluster.prototype.$openBucketSync = function(options) {
    var self = this;
    var name = options.bucket;
    this.buckets[name] = this.cluster.openBucket(name, options.password);

    this.buckets[name].on('connect', function() {
        this.emit('connect', self.buckets[name]);
    });

    this.buckets[name].on('error', function(err) {
        this.emit('error', err);
    });

    return this.buckets[name];
};


/**
 * $openBucket
 *
 * @param {Object} options
 * @param {String} options.bucket
 * @param {String} options.password
 *
 * @return {Promise<Bucket>}
 */
CouchbaseCluster.prototype.$openBucket = function(options) {
    var self = this;
    var name = options.bucket;

    return new Promise(function(resolve, reject) {
        self.buckets[name] = self.cluster.openBucket(name, options.password);

        self.buckets[name].on('connect', function() {
            resolve(self.buckets[name]);
        });

        self.buckets[name].on('error', reject);
    });
};

/**
 * build
 *
 * @param {Object} opt - options object
 * @return CouchbaseCluster
 */
CouchbaseCluster.build = function(opt) {
    return new CouchbaseCluster(opt);
}
