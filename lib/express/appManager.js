'use strict';

var App = require('./app.js');

module.exports = AppManager;

/**
 * AppManager
 *
 * @param {bi-config} config
 * @param {Object} models
 * @param {Object} models.odm
 * @param {Object} models.orm
 *
 * @constructor
 **/
function AppManager(config, models) {
    this.config = config;
    this.models = models;
    this.apps = [];
};

/**
 * add
 *
 * @param {App} app
 * @return {undefined}
 */
AppManager.prototype.add = function(app) {
    if (!(app instanceof App)) {
        throw new Error('Expecte instance of App but got: ' + typeof app);
    }
    this.apps.push(app);
};

/**
 * buildApp
 *
 * @param {Object} [options] - see {App} options for more details
 * @param {Object} [options.validator] - json-inspector initialization options
 *
 * @return {App}
 */
AppManager.prototype.buildApp = function(options) {
    var app = new App(this, this.config, this.models, options);
    return app;
};
