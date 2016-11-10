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
        var cmd = cli.server.command('integrity');
        cmd.description("Performs service availability checks on external resources");

        cmd.action(this.action(cli));

        return cmd;
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
            var apps = _.compact(cli.apps);
            if (!apps.length) {
                console.error('No app connected');
                return;
            }

            return Promise.map(apps, function(app) {
                return serviceIntegrity.inspect(app);
            }).catch(ServiceError, function(err) {
                return err.context;
            }).then(function(results) {
                console.log(cmd.print(results));
            }).catch(function(err) {
                console.error(err.stack);
                return null;
            }).asCallback(callback);
        };
    },

    /**
     * print
     *
     * @param {Array} results
     *
     * @return {String}
     */
    print: function print(results) {
        return Table.print(results, function(data, cell) {
            cell('APP', results.indexOf(data));
            cell('NODE', data.node);
            cell('COUCHBASE', data.couchbase);
            cell('POSTGRES', data.postgres);
        }, function(table) {
            return table.toString();
        });
    }
};

module.exports = Object.create(Command);
