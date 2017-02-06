var _         = require('lodash');
var Table     = require('easy-table');
var Validator = require('json-inspector');

var Route = require('../../express/route.js');

var Command = {
    /**
     * `ls` command
     *
     * @param {CLI} cli
     *
     * @return {Command}
     */
    build: function(cli) {
        return cli.server.command('inspect route <uid>')
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

            if (args.uid) {

                var routeInfo = cmd.inspectRoute(
                    cmd.findRoute(cli.options.apps, args.uid)
                );

                this.log(routeInfo);
                this.log(routeInfo.middlewares.validator.schema);
            }
            return callback();
        };
    },

    /**
     * @param {Route} route
     *
     * @return {Object}
     */
    inspectRoute: function inspectRoute(route) {
        var self, out;

        if (!(route instanceof Route)) {
            return {};
        }

        self = this;
        out = {
            method      : route.options.type,
            relativeUrl : route.Router.options.url + route.options.url,
            absoluteUrl : `https://127.0.0.1${route.options.url}`,
            middlewares : {}
        };

        route.steps.forEach(function(step) {
            if (!self.inspectMiddlewares.hasOwnProperty(step.name)) {
                return;
            }

            out.middlewares[step.name] = self.inspectMiddlewares[step.name](step.args, route);
        });

        return out;
    },

    inspectMiddlewares: {
        /**
         * @param {Array} args - argument list passed to the validator middleware
         * @param {Route} route
         * @return {Object}
         */
        validator: function validatorMiddlewareInspector(args, route) {
            var schema       = args[0]
            ,   target       = args[1]
            ,   customSchema = args[2]
            ,   options      = args[3];

            if (typeof schema === 'string') {
                schema = route.Router.App.options.validator.definitions[schema];
            }
            var validator = new Validator.Validator(schema, options);

            return {
                schema: JSON.stringify(
                    _.cloneDeepWith(validator.getSchema(customSchema), function(val) {
                        if (val === String) return 'String';
                    }) , null, 4),
                target: target
            };
        }
    },

    /**
     * @param {Array} apps
     * @param {String} uid
     *
     * @return {Route}
     */
    findRoute: function findRoute(apps, uid) {
        var route;

        apps = _.compact(apps);

        loop1: for (var i = 0, len = apps.length; i < len; i++) {
            var routers = apps[i].routers;

            if(!Array.isArray(routers)) continue;

            loop2: for (var y = 0, leng = routers.length; y < leng; y++) {
                var routes = routers[y].routes;

                if(!Array.isArray(routes)) continue;

                loop3: for (var z = 0, length = routes.length; z < length; z++) {
                    if (routes[z].uid == uid) {
                        route = routes[z];
                        break loop1;
                    }
                }
            }
        }

        return route;
    }
};

module.exports = Object.create(Command);
