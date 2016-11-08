var printApps = require('./ls').printApps;

/**
 * `use` command
 *
 * @param {CLI} cli
 *
 * @return {Command}
 */
exports = module.exports = function(cli) {
    var cmd = cli.server.command('use [apps]');
    cmd.description("Connects app[s] commands are executed against");

    cmd.action(action.bind(cli));

    return cmd;

};

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
    var apps = args.apps;

    if (typeof apps === 'string') {
        apps = apps.trim();
    }

    if (apps === '*') {
        cli.apps.splice(0, cli.apps.length);
        cli.apps.push.apply(cli.apps, cli.options.apps);
        printApps(cli.apps).split('\n').forEach(function(line) {
            if (line) {
                line = 'USING: ' + line;
            }
            console.log(line);
        });

    } else if (typeof apps === 'number') {
        var lines = printApps(cli.options.apps).split('\n');

        for (var i = 0, len = lines.length; i < len; i++) {
            var line = lines[i];
            if (line.indexOf(apps) !== -1) {
                cli.apps.splice(0, cli.apps.length);
                cli.apps[i] = cli.options.apps[i];
                console.log('USING: ' + line);
                break;
            }
        }
    } else {
        console.error('Invalid argument ' + apps);
    }

    return callback();
}
