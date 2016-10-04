'use strict'

//let _      = require('lodash');
let App = require('./app.js');

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
 * buildApp
 *
 * @param {Object} [options] - see {App} options for more details
 * @param {Object} [options.validator] - json-inspector initialization options
 *
 * @return {App}
 */
AppManager.prototype.buildApp = function(options) {
    let self = this;
    let app = new App(this.config);

    process.nextTick(function() {
        app.$init(self, options);
    });

    this.apps.push(app);
    return app;
};
