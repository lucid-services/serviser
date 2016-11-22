var staticData = require('../../staticData');
var Promise    = require('bluebird');

var Command = {

    /**
     * `integrity` command
     *
     * @param {CLI} cli
     * @return {Command}
     */
    build: function(cli) {
        return cli.server.command('static-data')
        .option('-r, --refresh', 'Reloads data from storage')
        .description("node's cached data manipulation")
        .action(this.action(cli));
    },

    /**
     * action
     *
     * @param {CLI} cli
     * @returns {Function}
     */
    action: function action(cli) {

        return function(args, callback) {

            return Promise.try(function() {
                if (args.options.refresh) {
                    var options = staticData.$getLastLoadOptions();

                    if (!options) {
                        return Promise.reject('Static data has never been loaded. Can NOT reload');
                    }

                    return staticData.load.apply(
                        staticData,
                        options
                    ).then(function() {
                        console.log('OK');
                    });
                }
            }).asCallback(callback);
        };
    },
};

module.exports = Object.create(Command);
