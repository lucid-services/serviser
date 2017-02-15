var _         = require('lodash');
var Table     = require('easy-table');
var Validator = require('json-inspector');
var util      = require('util');

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

                var schema = routeInfo.middlewares.validator.schema

                var stringified = reduce(schema, reducer.bind({offset: 4}), '');

                this.log(stringified);

                function reducer(str, val, key, breakLines) {
                    if (breakLines) {
                        str += _.repeat(' ', this.offset);
                    }
                    str += `${key}: `;

                    if (_.isPlainObject(val) || Array.isArray(val)) {
                        return reduce(
                            val,
                            reducer.bind({offset: this.offset + 4}),
                            str,
                            {
                                pre: preHook.bind({offset: this.offset}),
                                post: postHook.bind({offset: this.offset})
                            }
                        );
                    } else if(typeof val === 'string') {
                        val = `"${val}"`;
                    }

                    str += val;
                    if (breakLines) {
                        str += ',\n';
                    }
                    return str;
                }

                function preHook(str, val, breakLines) {
                    var char = '{';
                    if (val instanceof Array) {
                        char = '[';
                    }
                    str += char;
                    if (breakLines) {
                        str += '\n';
                    }
                    return str;
                }

                function postHook(str, val, breakLines) {
                    var char = '},';
                    if (val instanceof Array) {
                        char = '],';
                    }
                    if (breakLines) {
                        str += _.repeat(' ', this.offset);
                    }
                    return str + char + '\n';
                }

                function reduce(collection, iteratee, accumulator, hooks) {
                    hooks = hooks || {};
                    var breakLines = false;

                    if (_.isPlainObject(collection)) {
                        var keys = Object.keys(collection);
                        breakLines = keys.length > 1;

                        hooks.pre instanceof Function
                        && (accumulator = hooks.pre(accumulator, collection, breakLines));

                        keys.forEach(function(key) {
                            accumulator = iteratee(accumulator, collection[key], key, breakLines);
                        });
                    } else if(Array.isArray(collection)) {
                        breakLines = collection.length > 1;

                        hooks.pre instanceof Function
                        && (accumulator = hooks.pre(accumulator, collection, breakLines));

                        collection.forEach(function(item, key) {
                            accumulator = iteratee(accumulator, item, key, breakLines);
                        });
                    }
                    hooks.post instanceof Function && (accumulator = hooks.post(accumulator, collection, breakLines));
                    return accumulator;
                }

                //this.log(routeInfo);
                //this.log(util.inspect(routeInfo.middlewares.validator.schema, {depth: null, colors: true}));
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
                schema: _.cloneDeepWith(validator.getSchema(customSchema), function(val) {
                        if (val === String) return 'String';
                        if (val === Object) return 'Object';
                        if (val === Array) return 'Array';
                        if (val === Number) return 'Number';
                        if (val === Boolean) return 'Boolean';
                }),
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
