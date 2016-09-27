'use strict'

//let _      = require('lodash');
let App = require('./app.js');

module.exports = AppManager;

/**
 * AppManager
 *
 * @constructor
 **/
function AppManager(config) {
    this.config = config;
    this.apps = [];
};

/**
 * buildApp
 *
 * @return {App}
 */
AppManager.prototype.buildApp = function() {
    let app = new App(this.config);
    app.$init(this);

    this.apps.push(app);
    return app;
};
