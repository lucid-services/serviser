'use strict';

module.exports = AppManager;

const EventEmmiter = require('events');
const logger       = require('bi-logger');
const debug        = require('debug')('appManager');
const _            = require('lodash');

const App       = require('./app.js');
const AppStatus = require('./appStatus.js');
const Service   = require('../service.js');

/**
 * Creates, holds and manages individual App objects
 * @constructor
 * @extends EventEmitter
 *
 * @param {Service} service
 **/
function AppManager(service) {
    EventEmmiter.call(this);
    //
    if (!(service instanceof Service)) {
        throw new Error('`service` argument must be instanceof Service');
    }
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
 * @throws {Error} when App is not found
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
 * creates a new App instance
 * @param {Provider} config
 * @param {Object} [options] - see {App} options for more details
 * @param {Object} [options.validator] - json-inspector initialization options
 *
 * @return {App}
 */
AppManager.prototype.buildApp = function(config, options) {
    var app = new App(this, config, options);
    this.add(app);
    app.on('error', this.$buildAppErrorListener(app));
    this.emit('build-app', app);
    return app;
};

/**
 * @param {App} app
 * @private
 * @return {Function}
 */
AppManager.prototype.$buildAppErrorListener = function(app) {
    return function onAppError(err) {
        app.$setStatus(AppStatus.ERROR, err);
        debug(err.stack);
        logger.error(err);
    };
};
