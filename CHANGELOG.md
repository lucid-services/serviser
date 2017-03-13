## FUTURE

* [FIXED] explicit couchbase bindings should be required only when needed
* [FIXED] when we don't provide an `App` with odm `Client` model, the `router.buildRoute` method should not fail because of that. #5

## v0.8.1

* [FIXED] invalid module required in underlying `bi-docs` module. - this fix allows patched versions to be installed

## v0.8.0

* [ADDED] automatic documentation server generation
* [ADDED] `Route` constructor `summary` & `description` options for documenation purposes
* [CHANGED] behavior of the `Route.prototype.respondsWith` behavior. The methods accepts single `descriptor` argument which can be either `json-inspector` schema or `Error` constructor & instance

## v0.7.1

* [FIXED] wrapped `res` object provided to route middlewares broke express res methods as they were being called with incorrect context

## v0.7.0

* [CHANGED] use private npm module `bi-json-inspector` instead of global `json-inspector`
* [ADDED] common bi-service app initialization procedure as `bi-service/bin/www` script
* [ADDED] `Route.prototype.respondsWith` method - allows to describe data the route responds with
* [ADDED] `res.filter` method, which filters provided data and returns custom response object which works only with the filtered data
* [ADDED] `res` object provided to a route middlewares is simple wrapper object around the original express `res` object. That allows us implement additional methods, like the `res.filter` method
* [ADDED] `serviceIntegrity` debug points
* [ADDED] CLI - new `inspect route` command
* [ADDED] explicitly list `chalk` module as dependency (we have been already using it in bi-vantage)
* [ADDED] `bi-json-stringifier` module dependency
* [REMOVED] `route.stepsDict` hash table as it was unnecessary & unused

## v0.6.3

* [FIXED] `serviceIntegrity.inspectCouchbase` - if a bucket is not connected already, wait on `connect` or `error` event before the test get request is made
* [FIXED] don't print warning to stdout when `SEQEULIZE_DEBUG` is `undefined`
* [FIXED] `moduleLoader` - don't load unsupported files... load only files with an extension from `require.extensions`

## v0.6.2

* [FIXED] `staticData.loadSync` - convert stdout, stderr Buffers to strings (incorrect condition caused the buffers to NOT be converted)
* [FIXED] `staticData.loader` - particular db settings is taken from `storage.postgres.databases.staticData` config path
* [FIXED] `clientMiddleware` - the `restrictScope` & `restrictRedirect` options were ignored + added tests for the middleware (tests requires >kouchbase-odm@2.0.0-rc.1)
* [FIXED] fulfillent value (eg.: Response object) of the last route middleware was never being processed
* [FIXED] updated `kouchbase-odm` allowing versions greater than `2.0.0-rc.1`

## v0.6.1

* [FIXED] CLI - `ls -a` cmd should not crash when one of app servers is not running
* [FIXED] database/sequelize.js - don't crash an app when invalid `SEQUELIZE_DEBUG` option is set. Log warning instead.
* [FIXED] `sequelizeBuilder` don't ignore custom `logging` (function) option

## v0.6.0

* [ADDED] common cli initialization procedure via new static `CLI.init` method
* [ADDED] CLI - ls -r (aka. list routes) add additional column listing applied route's middlewares
* [ADDED] react on route middleware's fulfillment value. Allows to stop processing a request and respond to the request earlier.
* [FIXED] CLI - `vantage` remote authentication issues (authentication was made to work but has been disabled for now)
* [FIXED] min. `bi-config` version dumped to `0.7.1` - the version searches for config file name 'config.json5' by default
* [FIXED] `staticData.loader` - takes db config from `storage:postgres` config path instead of `storage:sequelize`
* [FIXED] CLI - support data logging to a remote cli console

## v0.5.1

* [FIXED] frozen CLI when we execute `integrity` cli command if no app is connected
* [FIXED] `req` & `res` objects memory leak. Incorrect `req` & `res` objects were being provided to a `Route.prototype.catch` error handler function


## v0.5.0

* [FIXED] min required `pg` module version (if installed as peer dependency)
* [ADDED] Route.prototype.catch method - reflects bluebirds Promise.catch method signature
* [ADDED] most of the `Route` methods were made chainable (`main`, `validate`, `restrictByClient`, `restrictByIp`, `restrictByOrigin`, `addStep`, `catch`)
* [ADDED] CLI `sort` && filter options to the `ls` command
* [FIXED] CLI error handling of synchrounously throwed errors (witout this fix, an app would crash with exit code != 0) on error
* [FIXED] Sequelize penetrator - don't load (require) `cache` module unless we want to penetrate cache support into a sequelize instance

## v0.4.0

* [CHANGED] `kouchbase-odm`, `bi-config`, `pg`, `pg-hstore`, `couchbase`, `cookie-parser`, `connect-flash`, `memcached`, `connect-memcached` modules are peer dependencies now - install what you need
