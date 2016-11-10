var ls = require('./ls');

var Command = {
    /**
     * @param {CLI} cli
     *
     * @return {Command}
     */
    build: function(cli) {
        var cmd = cli.server.command('using');
        cmd.description("Lists connected app[s]");

        cmd.action(this.action(cli));

        return cmd;
    },

    /**
     * action
     *
     * @param {CLI} cli
     */
    action: function action(cli) {
        return function(args, callback) {

            if (!cli.apps.length) {
                console.error('No app connected');
            }
            console.log(ls.printApps(cli.apps, {header: true}));
            callback();
        };
    }
};

module.exports = Object.create(Command);
