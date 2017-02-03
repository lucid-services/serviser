var ls = require('./ls');

var Command = {
    /**
     * @param {CLI} cli
     *
     * @return {Command}
     */
    build: function(cli) {
        return cli.server.command('using')
        .description("Lists connected app[s]")
        .action(this.action(cli));
    },

    /**
     * action
     *
     * @param {CLI} cli
     */
    action: function action(cli) {
        return function(args, callback) {

            if (!cli.apps.length) {
                throw new Error('No app connected');
            }
            this.log(ls.printApps(cli.apps, {header: true}));
            callback();
        };
    }
};

module.exports = Object.create(Command);
