/**
 * this file represents bi-service based app
 * and its purpose is to help test the bin/bi-service
 * shell executable
 */

const Service = require('../../../index.js');
const config = require('bi-config');

const service = module.exports = new Service(config);

Service.on('service', function(service) {
    service.resourceManager.add('test', config);
});

service.on('set-up', function() {
    if (!this.resourceManager.has('test')) {
        throw new Error('Events emitted in incorrect order');
    }
    //app1
    this.buildApp('app1');
    this.buildApp('app2', {validator: {allErrors: true}});

    Service.moduleLoader.loadModules([
        __dirname + '/routes/'
    ], {
        except: []
    });
});
