'use strict';

module.exports = Service;
module.exports.Service = Service;

var logger       = require('bi-logger');
var path         = require('path');
var fs           = require('fs');
var EventEmitter = require('events-bluebird');
var _            = require('lodash');
var Promise      = require('bluebird');
var debug        = require('debug')('bi-service');

var ResourceManager      = require('./resourceManager.js');
var RemoteServiceManager = require('./remoteServiceManager.js');
var AppManager           = require('./express/appManager.js');
var AppStatus            = require('./express/appStatus.js');
var configSchema         = require('./configSchema.js');

/**
 * @public
 * @constructor
 * @param {Config} config - npm bi-config object
 */
function Service(config) {
    this.config               = config;
    //ResourceManager is used for any resource that can be inspected for
    //its integrity eg. storage connections, remote dependent API services,
    //config provider etc...
    this.resourceManager      = new ResourceManager;
    this.appManager           = new AppManager(this);
    this.remoteServiceManager = null; //bi-service-sdk manager
    this.sqlModelManager      = null; //sql (sequelize) model manager
    this.cbModelManager       = null; //couchbase model manager

    this.$setProjectRoot();
    this.$setProjectName();
    this.$initLogger();
    this.$initAppWatcher();

    this.config.setInspectionSchema(configSchema);
    this.resourceManager.add('config', this.config);
    Service.emit('service', this);

}

Service.prototype.Service = Service;

Service.prototype = Object.create(EventEmitter.prototype, {
    constructor: {
        value: Service
    }
});

//public gateway for bi-service plugins
Service.emitter           = new EventEmitter;
Service.on                = Service.emitter.on.bind(Service.emitter);
Service.once              = Service.emitter.once.bind(Service.emitter);
Service.emit              = Service.emitter.emit.bind(Service.emitter);
Service.emitAsyncSeries   = Service.emitter.emitAsyncSeries.bind(Service.emitter);
Service.emitAsyncParallel = Service.emitter.emitAsyncParallel.bind(Service.emitter);

/**
 * @emits Service#listening - all registered apps are successfully initialized and at this point usually already can receive connections
 * @return {undefined}
 */
Service.prototype.$initAppWatcher = function() {
    var service     = this
    ,   numOfOKApps = 0;

    this.appManager.on('build-app', onBuildApp);

    function onBuildApp(app) {
        app.on('status-changed', onAppStatusChanged);
    }

    function onAppStatusChanged(status) {
        if (status === AppStatus.OK) {
            this.removeListener('status-changed', onAppStatusChanged);
            if (++numOfOKApps == this.appManager.apps.length) {
                this.appManager.removeListener('build-app', onBuildApp);
                service.emit('listening');
            }
        }
    }
};

/**
 * returns RemoteServiceManager and constructs one if there isn't any. This
 * requires `bi-service-sdk` npm module to be available
 *
 * @return {RemoteServiceManager}
 */
Service.prototype.getRemoteServiceManager = function() {
    if (this.remoteServiceManager === null) {
        this.remoteServiceManager = new RemoteServiceManager(
            this.config.get('services')
        );
    }

    return this.remoteServiceManager;
};

/**
 * @param {String} name - one of the keys of `apps` service config section
 * @param {Object} [options] - App constructor options
 *
 * @return {App}
 */
Service.prototype.buildApp = function(name, options) {

    var defaults = {
        name: name
    };

    var conf = this.config.getOrFail(`apps:${name}`);

    conf = this.config.createLiteralProvider(conf);
    options = _.assign(defaults, options);
    options.validator = options.validator || {};

    return this.appManager.buildApp(conf, options);
};


/**
 * @return {Promise}
 */
Service.prototype.$setup = function() {
    return this.resourceManager.inspectIntegrity().bind(this).then(function() {
        //public hook up for bi-service plugins
        return Service.emitAsyncSeries('set-up', this.appManager, this.config);
    }).then(function() {
        //last chance to prepare the environment before app definitions are
        //loaded
        return this.emitAsyncSeries('set-up');
    });
};

/**
 * @return {Service} self
 */
Service.prototype.start = function() {
    var self = this;

    process.nextTick(function() {
        return self.$setup().then(function() {
            //this implementation expects apps array growth in the loop
            for (var i = 0, app = null; i < this.appManager.apps.length; i++) {
                app = this.appManager.apps[i];
                app.once('post-init', Service.onPostInit);

                //public hook up for bi-service plugins
                Service.emit('app', app);
            }
        }).catch(function(err) {
            if (self.listenerCount('integrity-failure')) {
                self.emit('integrity-failure', err);
            } else {
                Service.emit('integrity-failure', err);
            }
        });
    });

    return this;
};


/**
 * @private
 * @return {Boolean}
 */
Service.prototype.$initLogger = function() {
    var cfg = this.config.get('logs');
    if (cfg) {
        logger.reinitialize(cfg);
        return true;
    }
    return false;
};


/**
 * @private
 * makes synchronous fs calls. ment to be called only within a period of
 * service initialization time window
 *
 * @param {String} [dir] - starting point of package.json lookup
 *
 * @return {String}
 */
Service.prototype.$setProjectRoot = function(dir) {
    var p = dir || path.dirname(require.main.filename);

    while ((fs.statSync(p)).isDirectory()) {
        try {
            p = require.resolve(p + '/package.json');
            break;
        } catch (e) {
            if (e.code !== 'MODULE_NOT_FOUND') {
                throw e;
            }

            var _p = path.resolve(p + '/../');

            if (_p == p)  break;

            p = _p;
        }
    }

    this.config.set('root', path.dirname(p));
    return this.config.get('root');
};


/**
 * @return {String}
 */
Service.prototype.$setProjectName = function() {
    var name = module.require(this.config.getOrFail('root') + '/package.json').name;
    this.config.set('npmName', name);
    return name;
};

/**
 * default Service.on('integrity-failure') listener
 *
 * @param {Error} err
 */
Service.on('integrity-failure', function(err) {
    if (this.listenerCount('integrity-failure') === 1) {
        logger.error(err, function() {
            process.exit(1);
        });
    }
});

/**
 * default app.on('post-init') listener
 *
 * @param {App} app
 */
Service.onPostInit = function onPostInit(app) {
    process.nextTick(function() {
        app.on('error', Service.onError);
        app.on('listening', Service.onListening);
        app.build();
        app.listen(app.config.get('listen'));
    });
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
