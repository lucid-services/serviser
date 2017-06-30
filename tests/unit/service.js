var m              = require('module');
var path           = require('path');
var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var logger         = require('bi-logger');
var EventEmitter   = require('events-bluebird');
var Promise        = require('bluebird');

var Service              = require('../../lib/service.js');
var AppManager           = require('../../lib/express/appManager.js');
var App                  = require('../../lib/express/app.js');
var RemoteServiceManager = require('../../lib/remoteServiceManager.js');
var ResourceManager      = require('../../lib/resourceManager.js');
var Config               = require('./mocks/config.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

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
        this.config = new Config;
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
                .should.be.equal(path.resolve(__dirname + '/../../node_modules/mocha'));
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
                this.logOpt = {
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

                this.loggerReinitializeSpy = sinon.spy(logger, 'reinitialize');
                this.configGetStub = sinon.stub(this.config, 'get');
                this.configGetStub.withArgs('logs').returns(this.logOpt);

                this.service = new Service(this.config);
            });

            afterEach(function() {
                this.loggerReinitializeSpy.reset();
            });

            after(function() {
                this.loggerReinitializeSpy.restore();
                this.configGetStub.restore();
            });

            it('should reinitialize static `bi-logger` module with options received from the bi-config', function() {
                this.loggerReinitializeSpy.should.have.been.calledOnce;
                this.loggerReinitializeSpy.should.have.been.calledWith(this.logOpt);
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

                this.requireStub = sinon.stub(this.serviceModule, 'require');
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

                this.config._store.root = '/project/root';
                this.config._store.apps = this.appsConfig;
            });

            afterEach(function() {
                this.setProjectRootStub.restore();
                this.requireStub.restore();
                this.setProjectNameStub.restore();
            });

            it('should return a new App object', function() {
                this.service.buildApp('public', {
                    validator: {definitions: {}}
                }).should.be.instanceof(App);
            });

            it('should try to require app validator definitions from default location', function() {
                var validatorDefinitions = {};
                var stub = this.requireStub.withArgs('/project/root/lib/validation/privateAppDefinitions')
                .returns(validatorDefinitions);

                var app = this.service.buildApp('private');
                app.should.be.instanceof(App);
                stub.should.have.been.calledOnce;
                app.options.validator.definitions.should.be.eql(validatorDefinitions);
            });
        });

        describe('$setup', function() {
            beforeEach(function() {
                this.service = new Service(this.config);

                this.requireStub = sinon.stub(this.serviceModule, 'require');
                this.inspectIntegrityStub = sinon.stub(this.service.resourceManager, 'inspectIntegrity');
                this.emitAsyncSeriesSpy = sinon.spy(this.service, 'emitAsyncSeries');
                this.emitSpy = sinon.spy(Service, 'emitAsyncSeries');
                this.setProjectNameStub = sinon.stub(Service.prototype, '$setProjectName');
                this.setProjectRootStub = sinon.stub(Service.prototype, '$setProjectRoot');

                this.inspectIntegrityStub.returns(Promise.resolve());

                this.config._store.root = '/project/root';
            });

            afterEach(function() {
                this.requireStub.restore();
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

            it('should try to require project/root/lib/app.js module with app service definitions', function() {
                var self = this;

                return this.service.$setup().then(function() {
                    self.requireStub.should.have.been.calledOnce;
                    self.requireStub.should.have.been.calledWith('/project/root/lib/app.js');
                    self.requireStub.should.have.been.calledAfter(self.emitAsyncSeriesSpy);
                }).should.be.resolved;
            });

            it('should synchrounously emit the `set-up` event on Service constructor', function() {
                var self = this;

                return this.service.$setup().then(function() {
                    self.emitSpy.should.have.been.calledOnce;
                    self.emitSpy.should.have.been.calledWith('set-up');
                    self.emitSpy.should.have.been.calledAfter(self.requireStub);
                    self.emitSpy.should.have.been.calledAfter(self.inspectIntegrityStub);
                }).should.be.resolved;
            });

            it('should return rejected promise', function() {
                this.inspectIntegrityStub.returns(Promise.reject());

                return this.service.$setup().should.have.been.rejected;
            });
        });

        describe('$initLogger', function() {
            before(function() {
                this.service = new Service(this.config);

                this.reinitializeSpy = sinon.spy(logger, 'reinitialize');
                this.configGetStub = sinon.stub(this.config, 'get');
            });

            beforeEach(function() {
                this.reinitializeSpy.reset();
                this.configGetStub.reset();
            });

            after(function() {
                this.reinitializeSpy.restore();
                this.configGetStub.restore();
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
                var stub = this.configGetStub.withArgs('logs').returns(logsConf);

                this.service.$initLogger();

                this.reinitializeSpy.should.have.been.calledOnce;
                this.reinitializeSpy.should.have.been.calledWith(logsConf);
            });

            it('should should NOT call the `reinitialize` method on bi-logger module', function() {
                var stub = this.configGetStub.withArgs('logs').returns(undefined);

                this.service.$initLogger();

                this.reinitializeSpy.should.have.callCount(0);
            });
        });
    });
});
