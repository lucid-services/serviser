'use strict';

module.exports = AppManager;

const EventEmmiter = require('events');
const logger       = require('bi-logger');
const debug        = require('debug')('appManager');
const _            = require('lodash');

const ExpressApp = require('./express/app.js');
const ShellApp   = require('./shell/app.js');
const App        = require('./common/app.js');
const AppStatus  = require('./common/appStatus.js');
const Service    = require('./service.js');

/**
 * emitted once per {@link AppManager#buildApp}.  
 * May be additionally emitted by plugins such as `bi-service-doc` & `bi-service-cli`
 * which add `AppManager.prototype.buildDoc` & `AppManager.prototype.buildCLI` methods respectivelly.
 * @event AppManager#build-app
 * @property {App} app
 */

/**
 * Creates, holds and manages individual {@link App} objects
 * @constructor
 * @extends EventEmitter
 *
 * @param {Service} service
 * @emits AppManager#build-app
 **/
function AppManager(service) {
    EventEmmiter.call(this);
    //
    if (!(service instanceof Service)) {
        throw new Error('`service` argument must be instanceof Service');
    }
    /**
     * @name AppManager#service
     * @instance
     * @type {Service}
     */
    this.service = service;
    this.apps    = [];
};

AppManager.prototype = Object.create(EventEmmiter.prototype);
AppManager.prototype.constructor = AppManager;
AppManager.prototype.super = EventEmmiter.prototype;

/**
 * adds app to its internal stack
 *
 * @param {App} app
 * @return {undefined}
 */
AppManager.prototype.add = function(app) {
    if (!(app instanceof App)) {
        throw new Error('Expected instance of App but got: ' + typeof app);
    }
    if (_.find(this.apps, ['options.name', app.options.name])) {
        throw new Error(`App name must be unique. Got duplicate of: ${app.options.name}`);
    }
    this.apps.push(app);
};

/**
 * receive previously created/registered App by its name
 *
 * @param {String} name
 *
 * @throws {Error} when the App is not found
 * @return {App}
 */
AppManager.prototype.get = function(name) {
    var app = _.find(this.apps, ['options.name', name])
    if (app) {
        return app;
    }
    throw new Error(`App "${name}" not found`);
};

/**
 * @private
 * @param {Function} Constructor
 * @param {Provider} config
 * @param {Object} [options] - see {App} options for more details
 * @param {Object} [options.validator] - json-inspector initialization options
 *
 * @emits AppManager#build-app
 * @return {App}
 */
AppManager.prototype.$buildApp = function(Constructor, config, options) {
    var app = new Constructor(this, config, options);
    this.add(app);
    app.on('error', this.$buildAppErrorListener());
    this.emit('build-app', app);
    return app;
};

/**
 * creates a new HTTP(S) App instance
 * @param {Provider} config
 * @param {Object} [options] - see {App} options for more details
 * @param {Object} [options.validator] - json-inspector initialization options
 *
 * @emits AppManager#build-app
 * @return {App}
 */
AppManager.prototype.buildApp = function(config, options) {
    return this.$buildApp(ExpressApp, config, options);
};

/**
 * creates a new Shell App instance
 * @param {Provider} config
 * @param {Object} [options] - see {App} options for more details
 * @param {Object} [options.validator] - json-inspector initialization options
 *
 * @emits AppManager#build-app
 * @return {App}
 */
AppManager.prototype.buildShellApp = function(config, options) {
    return this.$buildApp(ShellApp, config, options);
};

/**
 * @private
 * @return {Function}
 */
AppManager.prototype.$buildAppErrorListener = function() {
    return function onAppError(err) {
        this.$setStatus(AppStatus.ERROR, err);
        debug(err.stack);
        logger.error(err);
    };
};
