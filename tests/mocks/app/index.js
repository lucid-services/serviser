/**
 * this file represents bi-service based app
 * and its purpose is to help test the bin/bi-service
 * shell executable
 */

const Service = require('../../../index.js');
const config = require('bi-config');

const service = module.exports = new Service(config);

service.on('set-up', function() {
    //app1
    this.buildApp('app1');

    Service.moduleLoader.loadModules([
        __dirname + '/routes/'
    ], {
        except: []
    });
});
