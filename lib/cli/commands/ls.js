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
        return cli.server.command('ls [filter...]')
        .option('-a, --apps', 'Lists apps')
        .option('-r, --routes', "Lists app's routes")
        .action(this.action(cli));
    },

    /**
     * validate
     *
     * @param {CLI} cli
     * @return {String|undefined}
     */
    validate: function validate(cli) {
        return function(args) {
            if (args.options.routes) {
                if (args.filter.length % 2 !== 0) {
                    return console.error('Number of filter options should be even.');
                }

                if (!cli.apps.length) {
                    return console.error('No app selected. See `use` cmd');
                }
            }
        }
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
            cmd.validate(cli)(args);

            if (args.options.apps) {
                console.log(cmd.printApps(cli.options.apps, {header: true}));
            }

            if (args.options.routes) {

                var filter = args.filter.reduce(function(obj, opt, index, filter) {
                    if (index % 2 !== 0) {
                        obj[filter[index -1]] = opt;
                    }
                    return obj;
                }, {});

                console.log(cmd.printRoutes(cli.apps, {filter: filter}));
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
     * @param {Array}         apps
     * @param {Object}        [options]
     * @param {Object}        [options.filter]
     * @param {String|RegExp} [options.filter.method]
     * @param {String|RegExp} [options.filter.url]
     * @param {String|RegExp} [options.filter.uid]
     *
     * @return {String}
     */
    printRoutes: function printRoutes(apps, options) {
        var routeList = [];
        options = options || {};

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

        //filter route list by options.filter
        if (_.isPlainObject(options.filter) && Object.keys(options.filter).length) {
            _.remove(routeList, function(route, index) {
                return !( route.uid.match(options.filter.uid) !== null &&
                    route.url.match(options.filter.url) !== null &&
                    route.method.toLowerCase().match(options.filter.method) !== null );
            });
        }

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
