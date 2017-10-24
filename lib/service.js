'use strict';

module.exports = Service;
module.exports.Service = Service;

const logger       = require('bi-logger');
const path         = require('path');
const fs           = require('fs');
const EventEmitter = require('events-bluebird');
const _            = require('lodash');
const Promise      = require('bluebird');
const debug        = require('debug')('bi-service');

const ResourceManager      = require('./resourceManager.js');
const RemoteServiceManager = require('./remoteServiceManager.js');
const AppManager           = require('./express/appManager.js');
const AppStatus            = require('./express/appStatus.js');
const configSchema         = require('./configSchema.js');

/**
 * The main representation of a service as a whole.
 * Holds {@link AppManager}, {@link ResourceManager}, {@link RemoteServiceManager} as well as global
 * service configuration (Config) object. Optionally can hold references to
 * Model managers of various ODMs/ORMs
 *
 * @public
 * @constructor
 * @param {Config} config - npm bi-config object
 * @extends {EventEmitter} - patched with `emitAsyncSeries` & `emitAsyncParallel` methods
 */
function Service(config) {
    /**
     * see affiliated `bi-config` npm package
     * @name Service#config
     * @instance
     * @type {Config}
     */
    this.config               = config;
    /**
     * {@link ResourceManager} is used for any resource that can be inspected for
     * its integrity eg. storage connections, remote dependent API services,
     * config provider etc...
     *
     * @name Service#resourceManager
     * @instance
     * @type {ResourceManager}
     */
    this.resourceManager      = new ResourceManager;
    /**
     * @name Service#appManager
     * @instance
     * @type {AppManager}
     */
    this.appManager           = new AppManager(this);
    /**
     * @name Service#remoteServiceManager
     * @instance
     * @type {RemoteServiceManager}
     */
    this.remoteServiceManager = null; //bi-service-sdk manager
    /**
     * may be any service specific model manager of ORM  
     * Mentioned purely because of convention. Not required. Populated by the user.
     * @name Service#sqlModelManager
     * @instance
     * @type {null|Object}
     */
    this.sqlModelManager      = null; //sql (sequelize) model manager
    /**
     * couchbase model manager. See affiliated `kouchbase-odm` npm package.  
     * Mentioned purely because of convention. Not required. Populated by the user.
     * @name Service#cbModelManager
     * @instance
     * @type {null|Object}
     */
    this.cbModelManager       = null;

    if (this.config.get('exitOnInitError') === undefined) {
        this.config.set('exitOnInitError', true);
    }

    this.$setProjectRoot();
    this.$setProjectName();
    //if an uncaughException is "caugth" prior sucessfull service initialization
    //we want to exit the process with status code > 0 by default
    this.$initLogger({exitOnError: this.config.get('exitOnInitError')});
    this.$initAppWatcher();

    this.config.setInspectionSchema(configSchema);
    this.resourceManager.add('config', this.config);
    Service.emit('service', this);

    //once the service is sucessfully initialized, set the proper
    //logger exitOnError option
    this.once('listening', function() {
        logger.exitOnError = this.config.get('logs:exitOnError');
    });
}

/**
 * self reference
 * @name Service#Service
 * @instance
 * @type {Service}
 */
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
 * `listening` event is emitted on the Service instance once all registered Apps
 *  are sucessfully initialized (Status.INIT -> Status.OK)
 *
 * @private
 * @emits Service#error - one of the registered apps failed to initialize
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
        } else if (status === AppStatus.ERROR) {
            this.removeListener('status-changed', onAppStatusChanged);
            this.appManager.removeListener('build-app', onBuildApp);
            service.emit('error', this.statusReason);
        }
    }
};

/**
 * returns RemoteServiceManager or constructs one if there isn't any. This
 * requires `bi-service-sdk` npm module to be available
 *
 * @public
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
 * syntax sugar for building an {@link App} via {@link AppManager}
 *
 * @public
 * @param {String} name - one of the keys of `apps` service config section
 * @param {Object} [options] - see {@link App} constructor options
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
 * checks integrity of connected resources and then emits `set-up` events which
 * are expected to registed all Apps with Router & Route definitions.
 * `set-up` events are handled asynchronously and so can deal with Promises
 * returned from within event listeners
 *
 * @private
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
 * @public
 * @return {Promise<Service>}
 */
Service.prototype.listen = function() {
    var self = this;

    return new Promise(function(resolve, reject) {

        self.once('listening', onServiceListening);
        self.once('error', onServiceError);

        self.appManager.on('build-app', function(app) {
            app.once('post-init', Service.onPostInit);
        });

        return self.$setup().catch(function(err) {
            self.emit('error', err);
        });

        function onServiceListening() {
            self.removeListener('error', onServiceError);
            return resolve(self);
        }

        function onServiceError(err) {
            self.removeListener('listening', onServiceListening);
            logger.error(err, function() {
                if (self.config.get('exitOnInitError')) {
                    return process.exit(1);
                }
                reject(err);
            });
        }
    });
};

/**
 * calls {@link App#close} on each {@link App} in the {@link AppManager}
 *
 * @public
 * @return {Promise}
 */
Service.prototype.close = function() {
    return Promise.map(this.appManager.apps, function(app) {
        return app.close();
    }).return(this);
};

/**
 * @private
 * @param {Object} [override]
 * @return {Boolean}
 */
Service.prototype.$initLogger = function(override) {
    var cfg = this.config.get('logs');
    if (cfg) {
        logger.reinitialize(_.assign(cfg, override));
        return true;
    }
    return false;
};

/**
 * Starts at the path of main node module the process was started with and goes up
 * in directory hiearchy. As the project root is considered first directory which
 * constains package.json file.
 * Makes synchronous fs calls. ment to be called only within a period of
 * service initialization window.
 *
 * @private
 * @param {String} [dir] - starting point of package.json lookup
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
 * @private
 * @return {String}
 */
Service.prototype.$setProjectName = function() {
    var name = module.require(this.config.getOrFail('root') + '/package.json').name;
    this.config.set('npmName', name);
    return name;
};

/**
 * default app.on('post-init') listener
 *
 * @param {App} app
 */
Service.onPostInit = function onPostInit(app) {
    process.nextTick(function() {
        //public hook up for bi-service plugins
        Service.emit('app', app);
        app.once('listening', Service.onListening);
        app.build();
        if (app.status !== AppStatus.ERROR) {
            app.listen(app.config.get('listen'));
        }
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
