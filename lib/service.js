var EventEmmiter = require('events-bluebird');
var _            = require('lodash');
var Promise      = require('bluebird');

var ResourceManager = require('./resourceManager.js');
var AppManager      = require('./express/appManager.js');
var ServiceError    = require('./error/serviceError.js');

module.exports = Service;
module.exports.Service = Service;

/**
 * @public
 * @constructor
 * @param {Config} config
 */
function Service(config) {
    this.resourceManager = new ResourceManager;
    this.appManager = new AppManager({resourceManager: this.resourceManager});
    this.config = config;
    this.remoteServices = {};
    // cli
    // public
    // private
}

Service.prototype = Object.create(EventEmitter.prototype, {
    constructor: {
        value: Service
    }
});

Service.emitter           = new EventEmitter;
Service.on                = Service.emitter.on.bind(Service.emitter);
Service.once              = Service.emitter.once.bind(Service.emitter);
Service.emit              = Service.emitter.emit.bind(Service.emitter);
Service.emitAsyncSeries   = Service.emitter.emitAsyncSeries.bind(Service.emitter);
Service.emitAsyncParallel = Service.emitter.emitAsyncParallel.bind(Service.emitter);


/**
 * @public
 * @param {String} serviceName - eg. depot|user
 * @param {String} appName - eg. public|private|cli
 * @param {String} version - eg. v1.0
 * @return {BIServiceSDK}
 */
Service.prototype.getRemoteServiceClient = function(serviceName, appName, version) {
    if (!_.has(this.remoteServices, [serviceName, appName, version])) {
        throw new Error(`No such service client: ${serviceName}.${appName}.${version}`);
    }

    return this.remoteServices[serviceName][appName][version];
};


/**
 * 
 *
 * @return {undefined}
 */
Service.prototype.connectRemoteService = function(first_argument) {
    
};

/**
 * @return {Service} self
 */
Service.prototype.start = function() {
    this.resourceManager.inspectIntegrity().bind(this).then(function() {
        return this.emitAsyncSeries('set-up', this.resourceManager, this.config);
    }).then(function() {
        Service.emit('set-up', this.appManager, this.config);
        //this implementation expects apps array growth in the loop
        for (var i = 0, app = null; i < this.appManager.apps.length; i++) {
            app = this.appManager.apps[i];
            app.once('post-init', Service.onPostInit);

            Service.emit('app', app);
        }
    }).catch(function(err) {
        Service.emit('integrity-failure', err);
    });

    return this;
};

/**
 * default Service.on('integrity-failure') listener
 *
 * @param {Error} err
 */
Service.on('integrity-failure', function(err) {
    if (this.listenerCount('integrity-failure') === 1) {
        console.error(err);
        process.exit(1);
    }
});

/**
 * default app.on('post-init') listener
 *
 * @param {App} app
 */
Service.onPostInit = function onPostInit(app) {
    app.on('error', Service.onError);
    app.on('listening', Service.onListening);
    app.build();
    app.listen(app.config.get('listen'));
};

/**
 * default app.on('listening') listener
 *
 * @param {App} app
 */
Service.onListening = function onListening(app) {
    console.log(`${app.options.name} app listening on port: ${app.server.address().port}`);
};

/**
 * default app.on('error') listener
 *
 * @param {Error} err
 */
Service.onError = function onError(err) {
    debug(err.stack);
};
