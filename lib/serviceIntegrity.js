var Promise   = require('bluebird');
var Sequelize = require('@fogine/sequelize');
var Couchbase = require('couchbase');
var semver    = require('semver');

var CouchbaseCluster = require('./database/couchbase.js');
var ServiceError     = require('./error/serviceError.js');

var Inspector = {

    /**
     * @name $couchbaseDocumentKey
     * @type {String}
     */
    $couchbaseDocumentKey: 'User-1',

    /**
     * inspect
     *
     * @param {App} app
     **/
    inspect: Promise.method(function inspect(app) {
        var self = this;

        return Promise.props({
            postgres: this.inspectPostgres(app).reflect(),
            couchbase: this.inspectCouchbase(app).reflect(),
            node: Promise.try(function() {
                return self.inspectNode(app);
            }).reflect()
        }).then(function(results) {
            var err = false;

            Object.keys(results).forEach(function(name) {
                if (results[name].isRejected()) {
                    err = true;
                    results[name] = results[name].reason();
                } else {
                    results[name] = results[name].value();
                }
            });

            if (err) {
                return Promise.reject(new ServiceError(results));
            }

            return results;
        });
    }),

    /**
     * inspectCouchbase
     *
     * @param {App} app
     *
     * @return {Promise<boolean>}
     */
    inspectCouchbase: function inspectCouchbase(app) {
        var self = this;

        if (!(app.storage.couchbase instanceof CouchbaseCluster)) {
            return Promise.resolve(false);
        }

        var pendingBucketOperations = [];

        Object.keys(app.storage.couchbase.buckets).forEach(function(bucketName) {
            var promise = app.storage.couchbase.buckets[bucketName].getAsync(
                self.$couchbaseDocumentKey
            ).reflect();
            pendingBucketOperations.push(promise);
        });

        return Promise.all(pendingBucketOperations).then(function(results) {
            for (var i = 0, len = results.length; i < len; i++) {
                if (   results[i].isRejected()
                    && results[i].reason().code !== Couchbase.errors.keyNotFound
                ) {
                    return Promise.reject(results[i].reason());
                }
            }

            return true;
        });
    },

    /**
     * inspectPostgres
     *
     * @param {App} app
     *
     * @return {Promise<boolean>} - boolean indicates whether postgres connection has been verified
     */
    inspectPostgres: function inspectPostgres(app) {
        var self = this;

        if (!(app.sequelize instanceof Sequelize)) {
            return Promise.resolve(false);
        }

        return app.sequelize.query('SHOW server_version;', {
            type: app.sequelize.QueryTypes.SELECT
        }).then(function (results) {
            var version = results[0]['server_version'];
            var expectedVersion = app.config.get('postgres:version');

            return self.inspectVersion(version, expectedVersion, 'postgres');
        });
    },

    /**
     * inspectNode
     *
     * @param {App} app
     *
     * @return {boolean}
     *
     */
    inspectNode: function(app) {
        var expectedVersion = app.config.get('node_version');

        if (!expectedVersion) {
            return false;
        }

        return this.inspectVersion(
            process.versions.node,
            expectedVersion,
            'node'
        );
    },

    /**
     * inspectVersion
     *
     * @param {string} actualVersion
     * @param {string} requiredVersion
     * @param {string} subject
     *
     * @throws {Error}
     * @return {true}
     */
    inspectVersion: function inspectVersion(actualVersion, requiredVersion, subject) {
        if (   requiredVersion
            && semver.valid(requiredVersion)
            && semver.lt(actualVersion, requiredVersion)
        ) {
            throw new Error('Requires ' + subject + ' version >= ' + requiredVersion);
        }

        return true;
    }
};

exports = module.exports = Object.create(Inspector);
