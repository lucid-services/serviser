var _       = require('lodash');
var Promise = require('bluebird');
var Table   = require('easy-table');

var ServiceError     = require('../../error/serviceError.js');
var serviceIntegrity = require('../../serviceIntegrity.js');

var Command = {

    /**
     * `integrity` command
     *
     * @param {CLI} cli
     * @return {Command}
     */
    build: function(cli) {
        return cli.server.command('integrity')
        .description("Performs service availability checks on external resources")
        .action(this.action(cli));
    },

    /**
     * validate
     *
     * @param {CLI} cli
     * @return {String|undefined}
     */
    validate: function validate(cli) {
        return function(args) {
            if (!cli.apps.length) {
                throw new Error('No app selected. See `use` cmd');
            }
        }
    },

    /**
     * action
     *
     * @param {CLI} cli
     * @returns {Function}
     */
    action: function action(cli) {

        var cmd = this;

        return function(args, callback) {
            cmd.validate(cli).call(this, args);

            var apps = _.compact(cli.apps);

            return Promise.map(apps, function(app) {
                return serviceIntegrity.inspect(app);
            }).catch(ServiceError, function(err) {
                return [err.context];
            }).bind(this).then(function(results) {
                this.log(cmd.print(results, apps));
            }).catch(function(err) {
                this.log(err.stack);
                return null;
            }).asCallback(callback);
        };
    },

    /**
     * print
     *
     * @param {Array} results
     * @param {Array} apps
     *
     * @return {String}
     */
    print: function print(results, apps) {
        return Table.print(results, function(data, cell) {
            cell('ID', results.indexOf(data));
            cell('APP', apps[results.indexOf(data)].options.name);
            cell('NODE', data.node);
            cell('COUCHBASE', data.couchbase);
            cell('POSTGRES', data.postgres);
            cell('SESSION', data.session);
            cell('CONFIGURATION', data.configuration);
        }, function(table) {
            return table.toString();
        });
    }
};

module.exports = Object.create(Command);
