var ls = require('./ls');

var Command = {
    /**
     * @param {CLI} cli
     *
     * @return {Command}
     */
    build: function(cli) {
        return cli.server.command('use [apps]')
        .description("Connects app[s] commands are executed against")
        .action(this.action(cli));
    },

    /**
     * action
     *
     * @param {CLI} cli
     * @return {Function}
     */
    action: function action(cli) {
        return function(args, callback) {
            var self = this;
            var apps = args.apps;

            if (typeof apps === 'string') {
                apps = apps.trim();
            }

            if (apps === '*') {
                cli.apps.splice(0, cli.apps.length);
                cli.apps.push.apply(cli.apps, cli.options.apps);
                ls.printApps(cli.apps).split('\n').forEach(function(line) {
                    if (line) {
                        line = 'USING: ' + line;
                    }
                    self.log(line);
                });

            } else if (apps && ~['string', 'number'].indexOf(typeof apps)) {
                var lines = ls.printApps(cli.options.apps).split('\n');

                for (var i = 0, len = lines.length; i < len; i++) {
                    var line = lines[i];
                    if (line.indexOf(apps) !== -1) {
                        cli.apps.splice(0, cli.apps.length);
                        cli.apps[i] = cli.options.apps[i];
                        this.log('USING: ' + line);
                        break;
                    }
                }
            } else {
                this.log(new Error('Invalid argument ' + apps));
            }

            return callback();
        };
    }
};

module.exports = Object.create(Command);
