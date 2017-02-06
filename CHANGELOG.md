## FUTURE

* [FIXED] CLI - `ls -a` cmd should not crash when one of app servers is not running

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
