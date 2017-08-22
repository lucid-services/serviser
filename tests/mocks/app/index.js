/**
 * this file represents bi-service based app
 * and its purpose is to help test the bin/bi-service
 * shell executable
 */

var Service = require('../../../index.js');
var config = require('bi-config');

var service = module.exports = new Service(config);

service.on('set-up', function() {
    //app1
    this.buildApp('app1').buildRouter({
        url: '/',
        version: 1
    }).buildRoute({
        url: '/',
        type: 'get'
    });
});
