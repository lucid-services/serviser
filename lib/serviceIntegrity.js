var Promise   = require('bluebird');
var Sequelize = require('@fogine/sequelize');
var Couchbase = require('couchbase');
var semver    = require('semver');

var Bucket = Couchbase.BucketImpl;

var Inspector = {

    /**
     * inspect
     *
     * @param {App} app
     **/
    inspect: Promise.method(function inspect(app) {
        this.inspectNode();

        return Promise.all([
            this.inspectPostgres(app),
            this.inspectCouchbase(app)
        ]);
    }),

    /**
     * inspectCouchbase
     *
     * @param {App} app
     *
     * @return {Promise<boolean>}
     */
    inspectCouchbase: function inspectCouchbase(app) {
        if (!(app.storage.couchbase instanceof Bucket)) {
            return Promise.resolve(false);
        }
    },

    /**
     * inspectPostgres
     *
     * @param {App} app
     *
     * @return {Promise<boolean>} - boolean indicates whether postgres connection has been verified
     */
    inspectPostgres: function inspectPostgres(app) {
        if (!(app.sequelize instanceof Sequelize)) {
            return Promise.resolve(false);
        }

        return app.sequelize.query('SHOW server_version;', {
            type: app.sequelize.QueryTypes.SELECT
        }).then(function (results) {
            var version = results[0]['server_version'];
            var expectedVersion = app.config.get('postgres:version');

            if (   expectedVersion
                && semver.valid(version)
                && !semver.gte(version, expectedVersion)
            ) {
                return Promise.reject(new Error("Requires postgres version >= " + expectedVersion));
            }

            return true;
        });
    },

    /**
     * inspectNode
     *
     * @return {boolean}
     */
    inspectNode: function inspectNode() {

    }
};

exports = module.exports = Object.create(Inspector);
