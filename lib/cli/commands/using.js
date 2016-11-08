var printApps = require('./ls').printApps;

/**
 * `using` command
 *
 * @param {CLI} cli
 *
 * @return {Command}
 */
exports = module.exports = function(cli) {
    var cmd = cli.server.command('using');
    cmd.description("Lists connected app[s]");

    cmd.action(exports.action.bind(cli));

    return cmd;
}

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

    if (!cli.apps.length) {
        console.log('No app connected');
    }
    console.log(printApps(cli.apps, {header: true}));
    callback();
}
