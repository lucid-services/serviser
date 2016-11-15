var _     = require('lodash');
var Table = require('easy-table');

var Command = {
    /**
     * `ls` command
     *
     * @param {CLI} cli
     *
     * @return {Command}
     */
    build: function(cli) {
        var cmd = cli.server.command('ls');
        cmd.option('-a, --apps', 'Lists apps');
        cmd.option('-r, --routes', "Lists app's routes");

        cmd.action(this.action(cli));

        return cmd;
    },

    /**
     * action
     *
     * @param {CLI} cli
     * @return {Function}
     */
    action: function action(cli) {
        var cmd = this;

        return function(args, callback) {
            if (args.options.apps) {
                console.log(cmd.printApps(cli.options.apps, {header: true}));
            }

            if (args.options.routes) {
                if (!cli.apps.length) {
                    console.error('No app selected. See `use` cmd');
                } else {
                    console.log(cmd.printRoutes(cli.apps));
                }
            }
            return callback();
        };
    },

    /**
     * printApps
     *
     * @param {Array} apps
     * @param {Object} [opt]
     * @param {Boolean} [opt.header=false] - print table header
     *
     * @return {String}
     */
    printApps: function printApps(apps, opt) {
        var table = new Table;
        defaults = {
            header: false
        };

        opt = _.assign(defaults, opt);


        apps.forEach(function(app, index) {
            table.cell('ID', index);
            table.cell('NAME', app.options.name);
            table.cell('PORT', app.server.address().port);
            table.cell('STATUS', app.status);
            table.newRow();
        });

        if (opt.header) {
            return table.toString();
        } else {
            return table.print();
        }
    },

    /**
     * printRoutes
     *
     * @param {Array} apps
     *
     * @return {String}
     */
    printRoutes: function printRoutes(apps) {
        var routeList = [];

        _.compact(apps).forEach(function(app, index) {
            var routers = app.routers;

            if(!Array.isArray(routers)) return;

            routers.forEach(function(router) {
                var routes = router.routes;

                if(!Array.isArray(routes)) return;

                routes.forEach(function(route) {

                    var uid = route.uid || '';
                    var routerUrl = router.options && router.options.url || '';
                    var routeUrl = route.options && route.options.url || '';
                    var method = route.options && route.options.type || '';

                    var data = {
                        uid: uid,
                        url: routerUrl + routeUrl,
                        method: method.toUpperCase()
                    };

                    routeList.push(data);
                });
            });
        });

        _.sortBy(routeList, ['url', 'method']);

        return Table.print(routeList, function(data, cell) {
            cell('method', data.method);
            cell('url', data.url);
            cell('uid', data.uid);
        }, function(table) {
            return table.print();
        });
    }
};

module.exports = Object.create(Command);
