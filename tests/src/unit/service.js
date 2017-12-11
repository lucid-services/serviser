var _              = require('lodash');
var m              = require('module');
var path           = require('path');
var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var logger         = require('bi-logger');
var EventEmitter   = require('events-bluebird');
var Promise        = require('bluebird');
var Config         = require('bi-config');

var Service              = require('../../../lib/service.js');
var AppManager           = require('../../../lib/appManager.js');
var App                  = require('../../../lib/express/app.js');
var AppStatus            = require('../../../lib/common/appStatus.js');
var RemoteServiceManager = require('../../../lib/remoteServiceManager.js');
var ResourceManager      = require('../../../lib/resourceManager.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised', Promise);

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('Service', function() {

    before(function() {
        this.servicePath = path.resolve(__dirname + '/../../lib/service.js');
        this.serviceModule = m._cache[this.servicePath];
    });

    beforeEach(function() {
        this.config = new Config.Config;
    });

    describe('constructor', function() {

        it('should be instanceof EventEmitter', function() {
            (new Service(this.config)).should.be.instanceof(EventEmitter);
        });

        it('should expose public interface properties', function() {
            var s = new Service(this.config);

            s.config.should.be.equal(this.config);
            s.resourceManager.should.be.instanceof(ResourceManager);
            s.appManager.should.be.instanceof(AppManager);
            s.should.have.property('remoteServiceManager');
            s.should.have.property('sqlModelManager');
            s.should.have.property('cbModelManager');
        });

        it('should set valid "root" property value (project root path) of config store', function() {
            (new Service(this.config)).config.get('root')
                .should.be.equal(path.resolve(__dirname + '/../../../node_modules/mocha'));
        });

        it('should set valid "npmName" property of config store', function() {
            (new Service(this.config)).config.get('npmName')
                .should.be.equal('mocha');
        });

        it('should call self.$initLogger() method', function() {
            var initLoggerSpy = sinon.spy(Service.prototype, '$initLogger');

            var s = new Service(this.config);
            initLoggerSpy.should.have.been.calledOnce;
            initLoggerSpy.restore();
        });
    });

    describe('methods', function() {
        describe('$initLogger', function() {
            before(function() {
                this.loggerReinitializeSpy = sinon.spy(logger, 'reinitialize');
            });

            afterEach(function() {
                this.loggerReinitializeSpy.reset();
            });

            after(function() {
                this.loggerReinitializeSpy.restore();
            });

            it('should reinitialize static `bi-logger` module with options received from the bi-config', function() {
                var logOpt = {
                    transports: [
                        {
                            type: 'file',
                            dir: 'logs',
                            priority: 1,
                            level: 'error'
                        }
                    ]
                };
                //
                this.config.set('logs', logOpt);
                //
                this.service = new Service(this.config);
                //
                this.loggerReinitializeSpy.should.have.been.calledOnce;
                this.loggerReinitializeSpy.should.have.been.calledWith(
                    _.assign({exitOnError: true}, logOpt)
                );
            });
        });

        describe('getRemoteServiceManager', function() {
            before(function() {
                this.service = new Service(this.config);
            });

            it('should create new manager object if none does exist', function() {
                this.service.remoteServiceManager = null;

                var manager = this.service.getRemoteServiceManager();

                manager.should.be.instanceof(RemoteServiceManager);
                this.service.remoteServiceManager.should.be.equal(manager);
            });

            it('should return existing remoteServiceManager object', function() {
                var manager = this.service.getRemoteServiceManager();
                this.service.getRemoteServiceManager().should.be.equal(manager);
            });
        });

        describe('buildApp', function() {
            beforeEach(function() {

                this.setProjectNameStub = sinon.stub(Service.prototype, '$setProjectName');
                this.setProjectRootStub = sinon.stub(Service.prototype, '$setProjectRoot');

                this.service = new Service(this.config);

                this.appsConfig = {
                    public: {
                        listen: 3000,
                        baseUrl: '127.0.0.1:3000'
                    },
                    private: {
                        baseUrl: '127.0.0.1:3001',
                        listen: 3001
                    },
                };

                this.config.set('root', '/project/root');
                this.config.set('apps', this.appsConfig);
            });

            afterEach(function() {
                this.setProjectRootStub.restore();
                this.setProjectNameStub.restore();
            });

            it('should return a new App object', function() {
                this.service.buildApp('public', {
                    validator: {definitions: {}}
                }).should.be.instanceof(App);
            });

            it('should create an app object with proper Config object', function() {
                var app = this.service.buildApp('private');

                app.config.should.be.instanceof(Config.Config);
                app.config.get().should.have.property('baseUrl', this.appsConfig.private.baseUrl);
                app.config.get().should.have.property('listen', this.appsConfig.private.listen);
            });
        });

        describe('$setup', function() {
            beforeEach(function() {
                this.service = new Service(this.config);

                this.inspectIntegrityStub = sinon.stub(this.service.resourceManager, 'inspectIntegrity');
                this.emitAsyncSeriesSpy = sinon.spy(this.service, 'emitAsyncSeries');
                this.emitSpy = sinon.spy(Service, 'emitAsyncSeries');
                this.setProjectNameStub = sinon.stub(Service.prototype, '$setProjectName');
                this.setProjectRootStub = sinon.stub(Service.prototype, '$setProjectRoot');

                this.inspectIntegrityStub.returns(Promise.resolve());

                this.config.set('root', '/project/root');
            });

            afterEach(function() {
                this.inspectIntegrityStub.restore();
                this.emitAsyncSeriesSpy.restore();
                this.emitSpy.restore();
                this.setProjectNameStub.restore();
                this.setProjectRootStub.restore();
            });

            it('should call service.inspectIntegrity', function() {
                var self = this;

                return this.service.$setup().then(function() {
                    self.inspectIntegrityStub.should.have.been.calledOnce;
                }).should.be.resolved;
            });

            it('should asynchrounously emit `set-up` event on the service instance', function() {
                var self = this;

                return this.service.$setup().then(function() {
                    self.emitAsyncSeriesSpy.should.have.been.calledOnce;
                    self.emitAsyncSeriesSpy.should.have.been.calledWith('set-up');
                    self.emitAsyncSeriesSpy.should.have.been.calledAfter(self.inspectIntegrityStub);
                }).should.be.resolved;
            });

            it('should synchrounously emit the `set-up` event on Service constructor', function() {
                var self = this;

                return this.service.$setup().then(function() {
                    self.emitSpy.should.have.been.calledOnce;
                    self.emitSpy.should.have.been.calledWith('set-up');
                    self.emitSpy.should.have.been.calledAfter(self.inspectIntegrityStub);
                }).should.be.resolved;
            });

            it('should return rejected promise', function() {
                this.inspectIntegrityStub.returns(Promise.reject());

                return this.service.$setup().should.have.been.rejected;
            });
        });

        describe('$initLogger', function() {
            beforeEach(function() {
                this.service = new Service(this.config);
                this.reinitializeSpy = sinon.spy(logger, 'reinitialize');
            });

            afterEach(function() {
                this.reinitializeSpy.restore();
            });

            it('should call the `reinitialize` method on bi-logger module', function() {
                var logsConf = {
                    exitOnErr: false,
                    transports: [
                        {
                            type: 'file',
                            dir: 'logs',
                            priority: 1,
                            level: 'error'
                        }
                    ]
                };
                this.config.set('logs', logsConf);

                this.service.$initLogger();

                this.reinitializeSpy.should.have.been.calledOnce;
                this.reinitializeSpy.should.have.been.calledWith(logsConf);
            });

            it('should should NOT call the `reinitialize` method on bi-logger module', function() {
                this.config.set('logs', undefined);
                this.service.$initLogger();
                this.reinitializeSpy.should.have.callCount(0);
            });
        });

        describe('$initAppWatcher', function() {
            before(function() {
                this.service = new Service(this.config);
            });

            it('should emit the `listeing` event once all applications are initialized (status INIT -> status OK)', function(done) {
                var app1 = this.service.appManager.buildApp(
                    this.config,
                    {name: 'app1'}
                );
                var app2 = this.service.appManager.buildApp(
                    this.config,
                    {name: 'app2'}
                );

                setTimeout(function() {
                    app1.$setStatus(AppStatus.OK);
                }, 100);

                setTimeout(function() {
                    app2.$setStatus(AppStatus.OK);
                }, 200);

                this.service.once('error', function(err) {
                    done(err);
                });

                this.service.once('listening', function() {
                    done();
                });
            });
        });

        describe('listen', function() {
            beforeEach(function() {
                this.service = new Service(this.config);
                this.config.set('exitOnInitError', false);

                var conf1 = this.config.createLiteralProvider();
                var conf2 = this.config.createLiteralProvider();

                this.app1 = this.service.appManager.buildApp(conf1, {name: 'app1'});
                this.app2 = this.service.appManager.buildApp(conf2, {name: 'app2'});

                this.appListenStub = sinon.stub(App.prototype, 'listen').returns({});
            });

            afterEach(function() {
                this.appListenStub.restore();
            });

            it('should return resolved Promise once all apps are initializey to receive connections', function() {
                var self = this;

                setTimeout(function() {
                    self.app1.$setStatus(AppStatus.OK);
                }, 25);

                setTimeout(function() {
                    self.app2.$setStatus(AppStatus.OK);
                }, 50);

                return this.service.listen().should.be.fulfilled;
            });

            it('should return rejected Promise when an Error occurs during initialization of apps', function() {
                var self = this;
                var error = new Error('test error');

                setTimeout(function() {
                    self.app1.$setStatus(AppStatus.OK);
                }, 25);

                setTimeout(function() {
                    self.app2.$setStatus(AppStatus.ERROR, error);
                }, 80);

                return this.service.listen().should.be.rejectedWith(error);
            });
        });

        describe('close', function() {
            beforeEach(function() {
                this.service = new Service(this.config);

                var conf1 = this.config.createLiteralProvider();
                var conf2 = this.config.createLiteralProvider();

                this.app1 = this.service.appManager.buildApp(conf1, {name: 'app1'});
                this.app2 = this.service.appManager.buildApp(conf2, {name: 'app2'});

                this.appCloseSpy = sinon.spy(App.prototype, 'close');
            });

            afterEach(function() {
                this.appCloseSpy.restore();
            });

            it('should return fulfilled promise', function() {
                return this.service.close().should.be.fulfilled;
            });

            it('should call app.close() on each app', function() {
                var self = this;

                return this.service.close().then(function() {
                    self.appCloseSpy.should.have.been.calledTwice;
                }).should.be.fulfilled;
            });
        });
    });
});
