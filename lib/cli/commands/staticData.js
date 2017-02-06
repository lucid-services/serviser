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

            var self = this;

            return Promise.try(function() {
                if (args.options.refresh) {
                    var options = staticData.$getLastLoadOptions();

                    if (!options) {
                        return self.log(new Error('Static data has never been loaded. Can NOT reload'));
                    }

                    return staticData.load.apply(staticData, options).then(function() {
                        self.log('Inmemory data reloaded');
                    });
                } else {
                    return self.log(new Error('Not enough arguments'));
                }
            }).asCallback(callback);
        };
    },
};

module.exports = Object.create(Command);
