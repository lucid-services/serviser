## v1.0.0-alpha

* [ADDED] - `bi-service` cli executable
* [ADDED] - `ajv` validator support (replacement for `bi-json-inspector`)
* [REMOVED] - `bi-json-inspector` support
* [REMOVED] - `couchbase` integration modules (use bi-service-couchbase plugin)
* [REMOVED] - `loadORMmodels` method of `moduleLoader` has been removed - equivalent functionality is provided by `bi-service-sequelize`
* [REMOVED] - `loadODMmodels` method of `moduleLoader` use `moduleLoader.fileIterator` intead

## v0.16.2

* [FIXED] - request UID should be generated before any other middleware is executed
* [FIXED] - `bi-service` module exported incorrect error contructor (ServiceError) under `error.ValidationError` instead of the actual `ValidationError`

## v0.16.1

* [ADDED] - `AppManager.prototype.get` method
* [FIXED] - make sure that an `App` can write to its `Config`

## v0.16.0

* [CHANGED] - `Service.prototype.start` method has been renamed to `listen`
* [CHANGED] - use `bi-config` public interface to `set` values in config store
* [CHANGED] - `sequelize` support has been extracted to its own `bi-service-sequelize` package
* [REMOVED] - fixed (locked) loading of `lib/validation/{name}AppDefinitions` module when no validations were received
* [REMOVED] - fixed (locked) loading of `lib/app.js` module which may or may not be present. Responsibility of loading all application files is delegated to the user.
* [ADDED] - Service#listening event - emitted once when all service apps are ready to receive connections
* [ADDED] - service configuration inspection before startup
* [ADDED] - `Service.prototype.close` aka. shutdown all service apps
* [ADDED] - `App.prototype.close` aka. shutdown http server

## v0.15.3

* [FIXED] - `requestContentType` middleware should not fail when no `Content-Type` header is received on GET request

## v0.15.2

* [FIXED] - service `set-up` events should be emitted before a file with app definitions is fetched
* [ADDED] - `apps:$name:request:timeout` config option
* [ADDED] - `port` option to `database/sequelize` builder function
* [ADDED] - req `Content-Type` validation
* [REMOVED] - default (`ejs`) `view engine` express option is not set

## v0.15.1

* [FIXED] - `ServiceError.prototype.toLogger` didnt return json object (always returned undefined)

## v0.15.0

* [REMOVED] - `App.prototype.clone` method
* [REMOVED] - `App.prototype.useSDK` method
* [REMOVED] - `App.prototype.useCouchbase` method
* [REMOVED] - `App.prototype.useSequelize` method
* [REMOVED] - `App.prototype.useCacheStore` method
* [REMOVED] - bin/www module
* [ADDED] - a `ServiceError` is provided with route uid of a route which is called upon a request
* [ADDED] - `Sequelize.prototype.inspectIntegrity` method
* [ADDED] - `CouchbaseCluster.prototype.inspectIntegrity` method
* [ADDED] - `Service` class
* [ADDED] - `RemoteServiceManager` class
* [ADDED] - `ResourceManager` class

## v0.14.2

* [FIXED] - bumped `bi-json-inspector@1.0.0-rc.4` which fixes security bug related to untrusted validation data source

## v0.14.1

* [FIXED] - `Route.prototype.getUrl` - express-like regex matching part of url segment should be stripped (`/path/:id(\d+)` => `/path/:id`)
* [FIXED] - `Route.prototype.getUrl` - incorrect url path segment substitution

## v0.14.0

* [REMOVED] - `Route.prototype.restrictByClient` - extracted to stand-alone package `bi-service-oauth-client`
* [REMOVED] - `Route.prototype.restrictClientOrigin` - extracted to stand-alone package `bi-service-oauth-client`
* [REMOVED] - `Route.prototype.restrictClientRedirect` - extracted to stand-alone package `bi-service-oauth-client`
* [FIXED] - logging of sequelize sql queries was forced to be turned on
* [ADDED] - `App.prototype.getHost` - return `$protocol+$host` url
* [ADDED] - `Route.prototype.getAbsoluteUrl`

## v0.13.2

* [FIXED] - export `ForbiddenError` from the module

## v0.13.1

* [FIXED] - fix hardcoded `postgres` dialect when checking integrity of sequelize (added support for `mysql` & `mariadb` dialects)

## v0.13.0

* [CHANGED] - `clientMiddleware` requires `privateDepot` SDK to be connected to an app
* [ADDED] - `App.prototype.useCacheStore` method
* [ADDED] - a service startup should fail when an app is in ERROR state after it's been initialized and is about to start listening on a port
* [ADDED] - `Route.prototype.getUrl` method
* [ADDED] - `App.prototype.getRoute` method
* [ADDED] - `getUrl` function for templates

## v0.12.1

* [FIXED] - `clientMiddleware` should search for `client-id` & `client-secret` headers instead of `client_id` & `client_secret`

## v0.12.0

* [ADDED] - `App.prototype.useSDK` method which integrates with `services` app `config` section
* [ADDED] - `Route` constructor takes new optional `sdkMethodName` option
* [REMOVED] - `connect-flash` peer dependency. The module was being explicitly loaded during session initialization `Route.prototype.useSession`
* [FIXED] - implementation of handling the `baseUrl` config value. Routers are now aware of the root base path value. This way we don't break API for modules which depend on it.
* [ADDED] - http json response fallback when request fails and the custom `error-response` event listener is registered
* [REMOVED] - startup availability check of dependent web services
* [ADDED] - `moduleLoader.loadModules` accepts optional `cb` function option which will be called and provided with each required module
* [ADDED] - `serviceIntegrity.inspect` method accepts optional `inspectors` option

## v0.11.1

* [FIXED] - `baseUrl` path string was being parsed incorrectly which led to routers being binded to incorrect endpoint
* [FIXED] - `connect-flash` package was being incorrectly initialized when `Route.prototype.useSession` is called this led to a request hangup

## v0.11.0

* [FIXED] - `res.filter(data)` - should ensure native `ValidationError` of `json-ispector` package is thrown when validation/filtering fails
* [ADDED] - support `baseUrl` App config option value that contains path string eg.: '127.0.0.1/root/app/path'

## v0.10.4

* [FIXED] - client middleware - invalid api code key was being accessed when an error occured

## v0.10.3

* [FIXED] an `Error` is throwed when a `Router` is trying to register a `Route` with non-unique route `uid`. `uid` should be unique in context of an `App`
* [FIXED] an `Error` is throwed when a App defines non-unique `name` option
* [FIXED] each `App` presents itself independently to the `bi-depot` - this prevents service scope collision

## v0.10.2

* [FIXED] `restrictByClient` looks for `bi-depot` settings under `services.privateDepot` key instead of `services.private-depot`

## v0.10.1

## v0.10.0

* [CHANGED] renamed `Route.prototype.restrictByOrigin` method to `restrictClientOrigin`
* [CHANGED] don't include `success=false` property in unsuccessful response (`RequestError`)
* [CHANGED] `epxress-session` module is not explicitly required anymore and has been setup as a peer dependency
* [CHANGED] underlying format of route's response descriptors - route.description.responses[code] is an `array` instead of `object`
* [ADDED] `bi-api-errors` dependency
* [ADDED] `AppManager.prototype.buildApp` emits a `build-app` event with a new App
* [ADDED] `App.prototype.buildRouter` emits a `build-router` event with a new Router
* [ADDED] new App `error-response` event which when registered, defers response of globaly handled errors to an user defined logic.
* [ADDED] automatically describe possible error response codes of "native" middlewares with the `Route.prototype.respondsWith` method
* [ADDED] `Route.prototype.restrictClientRedirect` method
* [ADDED] `serviceIntegrity` inspects that an app can connect to its dependent web services
* [ADDED] support multiple calls to the `route.respondsWith` method with same type of `Error` object (Error objects which all resolve to same response code). The errors are stacked and not overwriten - as it is for success response schema provided to the method.
* [REMOVED] `Route.prototype.restrictByIp` method
* [REMOVED] `restrictRedirect` option of the `restrictByClient` method in favor of `Route.prototype.restrictClientRedirect` method
* [REMOVED] the module no longer exports optionally dependent `Couchbase` & `CouchbaseODM` dependencies use `require('couchbase')` instead
* [FIXED] request identifier should be set to an Error object before the err is logged
* [FIXED] `res.filter(data)` should not fail when we defined a response schema  as reference to registered validator (`route.respondsWith('#valName')`)
* [FIXED] `json-inspector` `required` option should be set to `false` for response data filtering due to consistency among all schema definitions
* [FIXED] `res.filter(data)` should not throw a `TypeError` when we provide `null` data

## v0.9.2

* [FIXED] `res.filter(data)` should convert the data object to json via data.toJSON if we provide non-plain data object
* [FIXED] `Route.prototype.respondsWith` should accept json-inspector schema definition in form of a function
* [FIXED] use `bi-json-inspector@1.0.0-rc.3c` - fixes the issue with broken lodash compatibility in a patch version
* [FIXED] failure of `serviceIntegrity.inspect` - tried require couchbase bindings even in the case when app doesn't use couchbase
* [FIXED] export all custom Errors out of the module

## v0.9.1

* [FIXED] `staticData.loader` semantic error with variable declaration order

## v0.9.0

* [CHANGED] explicit `bi-service-cli` & `bi-service-doc` (renamed `bi-cli` & `bi-docs`) dependencies has been removed. Individual projects should require the modules as a plugin.
* [ADDED] emitter interface for the common initialization procedure of `bin/www` script

## v0.8.4
## v0.8.3

## v0.8.2

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
