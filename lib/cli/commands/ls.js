var _     = require('lodash');
var Table = require('easy-table');

/**
 * `ls` command
 *
 * @param {CLI} cli
 *
 * @return {Command}
 */
exports = module.exports = function(cli) {
    var cmd = cli.server.command('ls');
    cmd.option('-a, --apps', 'Lists apps');
    cmd.option('-r, --routes', "Lists app's routes");

    cmd.action(exports.action.bind(cli));

    return cmd;
};

exports.action = action;
exports.printApps = printApps;
exports.printRoutes = printRoutes;

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
    if (args.options.apps) {
        console.log(printApps(this.options.apps, {header: true}));
    }

    if (args.options.routes) {
        if (!this.apps.length) {
            console.error('No app selected. See `use` cmd');
        } else {
            console.log(printRoutes(this.apps));
        }
    }
    return callback();
}

/**
 * printApps
 *
 * @param {Array} apps
 * @param {Object} [opt]
 * @param {Boolean} [opt.header=false] - print table header
 *
 * @return {String}
 */
function printApps(apps, opt) {
    var table = new Table;
    defaults = {
        header: false
    };

    opt = _.assign(defaults, opt);


    apps.forEach(function(app, index) {
        table.cell('ID', index);
        table.cell('PORT', app.server.address().port);
        table.cell('STATUS', app.status);
        table.newRow();
    });

    if (opt.header) {
        return table.toString();
    } else {
        return table.print();
    }
}


/**
 * printRoutes
 *
 * @param {Array} apps
 *
 * @return {String}
 */
function printRoutes(apps) {
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
