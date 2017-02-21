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
        .option('-s, --sort', "Defines sort order. Can contain characters m|u|i|d which corresponds to (m)ethod, (u)rl, u(i)d and mi(d)dleware columns")
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
                if (!Array.isArray(args.filter)) {
                    args.filter = [];
                }

                if (!cli.apps.length) {
                    throw new Error('No app selected. See `use` cmd');
                }

                if (args.filter.length % 2 !== 0) {
                    throw new Error('Number of filter options should be even.');
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
            cmd.validate(cli).call(this, args);

            if (args.options.apps) {
                this.log(cmd.printApps(cli.options.apps, {header: true}));
            }

            if (args.options.routes) {

                var filter = args.filter.reduce(function(obj, opt, index, filter) {
                    if (index % 2 !== 0) {
                        obj[filter[index -1]] = opt;
                    }
                    return obj;
                }, {});

                this.log(cmd.printRoutes(cli.apps, {
                    filter: filter,
                    sort: args.options.sort
                }));
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
            table.cell('PORT', (app.server && app.server.address().port) || 'undefined');
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
     * @param {String|RegExp} [options.filter.middleware]
     * @param {String}        [options.sort] - Defines sort order. Can contain characters m|u|i|d which corresponds to (m)ethod, (u)rl, u(i)d and mi(d)dleware
     *
     * @return {String}
     */
    printRoutes: function printRoutes(apps, options) {
        var routeList = [];
        var sortMap = {
            u: 'url',
            m: 'method',
            i: 'uid',
            d: 'middlewares'
        };
        options = options || {};
        options.sort = options.sort || 'um';

        //construct a list of all app's routes
        _.compact(apps).forEach(function(app, index) {
            var routers = app.routers;

            if(!Array.isArray(routers)) return;

            routers.forEach(function(router) {
                var routes = router.routes;

                if(!Array.isArray(routes)) return;

                routes.forEach(function(route) {

                    var uid       = route.uid || '';
                    var routerUrl = router.options && router.options.url || '';
                    var routeUrl  = route.options && route.options.url || '';
                    var method    = route.options && route.options.type || '';

                    var middlewares = route.steps.reduce(function(output, step) {
                        if (step.name.match(/[^0-9]+/)) {
                            output.push(step.name);
                        }
                        return output;
                    }, [])

                    var data = {
                        uid         : uid,
                        url         : routerUrl + routeUrl,
                        method      : method.toUpperCase(),
                        middlewares : middlewares.sort().join(' ')
                    };

                    routeList.push(data);
                });
            });
        });

        //filter route list by options.filter
        if (_.isPlainObject(options.filter) && Object.keys(options.filter).length) {
            _.remove(routeList, function(route, index) {
                return !( route.uid.match(options.filter.uid) !== null &&
                    route.url.match(options.filter.url) !== null &&
                    route.middlewares.match(options.filter.middleware) !== null &&
                    route.method.toLowerCase().match(options.filter.method) !== null );
            });
        }

        // Sort route list
        var order = [];
        for (var i = 0, len = options.sort.length; i < len; i++) {
            if (sortMap.hasOwnProperty(options.sort[i])) {
                order.push(sortMap[options.sort[i]]);
            }
        }

        routeList = _.sortBy(routeList, order);

        return Table.print(routeList, function(data, cell) {
            cell('method', data.method);
            cell('url', data.url);
            cell('uid', data.uid);
            cell('middleware', data.middlewares);
        }, function(table) {
            return table.print();
        });
    }
};

module.exports = Object.create(Command);
