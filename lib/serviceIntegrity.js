var debug         = require('debug')('serviceIntegrity');
var _             = require('lodash');
var Promise       = require('bluebird');
var Sequelize     = require('sequelize');
var semver        = require('semver');
var jsonInspector = require('bi-json-inspector');
var request       = require('request-promise');

var ServiceError = require('./error/serviceError.js');

var Inspector = {

    /**
     * @name $couchbaseDocumentKey
     * @type {String}
     */
    $couchbaseDocumentKey: 'User-1',

    /**
     * @name $sessionKey
     * @type {String}
     */
    $sessionKey: 'key',

    /**
     * @name $supportedSessionStores
     * @type {Array}
     */
    $supportedSessionStores: [
        'MemcachedStore'
    ],

    /**
     * @param {App} app
     * @param {Object} options
     * @param {Object<string,Promise>} options.inspectors - additional inspectors
     *
     * @return {Promise<Object<key, boolean>>}
     **/
    inspect: Promise.method(function inspect(app, options) {
        options = options || {};
        var self = this;

        var inspectors = {
            postgres: this.inspectPostgres(app).reflect(),
            couchbase: this.inspectCouchbase(app).reflect(),
            session: this.inspectSession(app).reflect(),
            node: Promise.try(function() {
                return self.inspectNode(app);
            }).reflect(),
            configuration: Promise.try(function() {
                return self.inspectConfiguration(app);
            }).reflect()
        };

        if (_.isPlainObject(options.inspectors)) {
            _.reduce(options.inspectors, function(out, inspector, name) {
                //assume we've got a promise object
                if (   typeof inspector.then === 'function'
                    && typeof inspector.catch === 'function'
                ) {
                    out[name] = Promise.resolve(inspector).reflect();
                }
                return out;
            }, inspectors)
        }

        return Promise.props(inspectors).then(function(results) {
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
     * verifies that we can connect to a couchbase instance and each defined bucket
     *
     * @param {App} app
     *
     * @return {Promise<boolean>}
     */
    inspectCouchbase: Promise.method(function inspectCouchbase(app) {
        if (!app.storage.couchbase) {
            return false;
        }

        var CouchbaseCluster = require('./database/couchbase.js')
        ,   Couchbase        = require('couchbase')
        ,   self             = this;

        if (!(app.storage.couchbase instanceof CouchbaseCluster)) {
            return false;
        }

        var pendingBucketOperations = [];

        Object.keys(app.storage.couchbase.buckets).forEach(function(bucketName) {
            var bucket = app.storage.couchbase.buckets[bucketName];

            var promise = ensureConnected(bucket).then(function() {
                debug('Initializing bucket.get request attempt for bucket: ' + bucketName);
                return bucket.getAsync(
                    self.$couchbaseDocumentKey
                );
            }).reflect();

            pendingBucketOperations.push(promise);
        });

        return Promise.all(pendingBucketOperations).then(function(results) {
            for (var i = 0, len = results.length; i < len; i++) {
                debug(`Bucket integrity evaluation status: ${results[i].isRejected() ? 'failure' : 'ok'}`);
                if (   results[i].isRejected()
                    && results[i].reason().code !== Couchbase.errors.keyNotFound
                ) {
                    debug('Bucket integrity failure', results[i].reason());
                    return Promise.reject(results[i].reason());
                }
            }

            return true;
        });

        function ensureConnected(bucket) {
            return new Promise(function(resolve, reject) {

                if (bucket.connected) {
                    return resolve();
                }

                bucket.once('connect', function() {
                    debug('Bucket connected');
                    return resolve();
                });

                bucket.once('error', function(err) {
                    debug('Bucket connection failure', err);
                    return reject(err);
                });
            });
        }
    }),

    /**
     * verifies that the app can connect to its dependent services defined
     * under `services` key of app's configuration object
     * returns an Error if any check fail; true if all checks passed; false if
     * the app has not any services defined
     *
     * @param {App} app
     *
     * @return {Promise<boolean>}
     */
    inspectDependentServices: Promise.method(function inspectDependentServices(app) {
        var services = app.config.get('services');

        if (!services || !_.isPlainObject(services) || !Object.keys(services).length) {
            return false;
        }

        return Promise.map(Object.keys(services), function(name) {
            var service = services[name];

            var url = (service.ssl ? 'https': 'http') + '://' + service.host;
            return request.get({
                uri: url,
                simple: false,
                resolveWithFullResponse : true
            }).then(function(response) {
                if (response.statusCode >= 500) {
                    throw new Error(`Failed to connect to a service ${url}, response code: ${response.statusCode}`);
                }
            });
        }).return(true);
    }),

    /**
     * verifies that we can connect to a postgres instance and that min. required version
     * is installed.
     *
     * @param {App} app
     *
     * @return {Promise<boolean>} - boolean indicates whether postgres connection has been verified
     */
    inspectPostgres: Promise.method(function inspectPostgres(app) {
        var self = this;

        if (!(app.sequelize instanceof Sequelize)) {
            return false;
        }

        return app.sequelize.query('SHOW server_version;', {
            type: app.sequelize.QueryTypes.SELECT
        }).then(function (results) {
            var version = results[0]['server_version'];
            var expectedVersion = app.config.get('postgres:version');

            return self.inspectVersion(version, expectedVersion, 'postgres');
        });
    }),

    /**
     * verifies whether we run on min. required nodejs
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
     * validates app's configuration object
     *
     * @param {App} app
     *
     * @throws Error
     * @return {true}
     */
    inspectConfiguration: function(app) {
        if (!_.has(app, 'options.validator.definitions[#appConfiguration]')) {
            throw new Error("App's configuration schema definition is mandatory");
        }
        var schema = app.options.validator.definitions['#appConfiguration'];

        var validator = new jsonInspector.Validator(schema, {
            filterData: false,
            nullable: true
        });

        validator.validate(app.config.get());

        if (!validator.success) {
            throw validator.error;
        }

        return true;
    },

    /**
     * verifies that we can connect to a session store (eg. Memcached)
     *
     * @param {App} app
     *
     * @return {Promise<boolean>}
     */
    inspectSession: Promise.method(function(app) {
        var constructorName;

        if (app.storage.session === null) {
            return false;
        }

        constructorName = Object.getPrototypeOf(app.storage.session).constructor.name;

        if (~this.$supportedSessionStores.indexOf(constructorName)) {
            var memcachedGet = Promise.promisify(app.storage.session.client.get, {
                context: app.storage.session.client
            });

            return memcachedGet(this.$sessionKey).return(true);
        } else {
            throw new Error('Unsupported session store');
        }
    }),

    /**
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
