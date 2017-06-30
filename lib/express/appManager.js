'use strict';

module.exports = AppManager;

var EventEmmiter = require('events');
var logger       = require('bi-logger');
var debug        = require('debug')('appManager');
var _            = require('lodash');

var App       = require('./app.js');
var AppStatus = require('./appStatus.js');
var Service   = require('../service.js');

/**
 * AppManager
 *
 * @constructor
 * @extends EventEmitter
 *
 * @param {Service} service
 **/
function AppManager(service) {
    EventEmmiter.call(this);

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
 * add
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
 * buildApp
 *
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
 *
 * @param {App} app
 *
 * @return {Function}
 */
AppManager.prototype.$buildAppErrorListener = function(app) {
    return function onAppError(err) {
        app.$setStatus(AppStatus.ERROR, err);
        debug(err.stack);
        logger.error(err);
    };
};

