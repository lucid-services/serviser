var _       = require('lodash');
var Promise = require('bluebird');
var Table   = require('easy-table');

var ServiceError     = require('../../error/serviceError.js');
var serviceIntegrity = require('../../serviceIntegrity.js');

/**
 * `integrity` command
 *
 * @param {CLI} cli
 * @return {Command}
 */
exports = module.exports = function(cli) {
    var cmd = cli.server.command('integrity');
    cmd.description("Performs service availability checks on external resources");

    cmd.action(exports.action.bind(cli));


    return cmd;
};

exports.action = action;

/**
 * action
 *
 * core logic of the cmd
 *
 * @this {CLI}
 * @param {Object} args
 * @param {Function} callback
 */
function action(args, callback) {
    var cli = this;
    var apps = _.compact(cli.apps);
    if (!apps.length) {
        console.log('No app connected');
    }

    return Promise.map(apps, function(app) {
        return serviceIntegrity.inspect(app);
    }).catch(ServiceError, function(err) {
        return err.context;
    }).then(function(results) {
        console.log(print(results));
    }).asCallback(callback);
}


/**
 * print
 *
 * @param {Array} results
 *
 * @return {String}
 */
function print(results) {
    return Table.print(results, function(data, cell) {
        cell('APP', results.indexOf(data));
        cell('NODE', data.node);
        cell('COUCHBASE', data.couchbase);
        cell('POSTGRES', data.postgres);
    }, function(table) {
        return table.toString();
    });
}
