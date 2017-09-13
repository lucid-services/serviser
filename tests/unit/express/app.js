var sinon               = require('sinon');
var chai                = require('chai');
var chaiAsPromised      = require('chai-as-promised');
var sinonChai           = require("sinon-chai");
var http                = require('http');
var https               = require('https');
var Express             = require('express');
var logger              = require('bi-logger');
var Config              = require('bi-config');

var Service          = require('../../../lib/service.js');
var AppManager       = require('../../../lib/express/appManager.js');
var Router           = require('../../../lib/express/router.js');
var Route            = require('../../../lib/express/route.js');
var AppStatus        = require('../../../lib/express/appStatus.js');
var Server           = require('../mocks/server.js');
var MemcachedStoreMock   = require('../mocks/memcachedStore.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('App', function() {

    beforeEach(function() {
        this.config = new Config.Config;

        this.service  = new Service(this.config);
        this.appManager = this.service.appManager;

        this.service.on('error', function() {
            //muted as we don't test Service object here
        });
    });

    afterEach(function() {
        delete this.config;
        delete this.appManager;
    });

    describe('constructor', function() {
        it('should throw an Error when we try to create an App with no `name` option set', function() {
            var self = this;

            function tCase() {
                self.appManager.buildApp(self.config, {});
            }

            expect(tCase).to.throw(Error);
        });

        it('should throw an Error when a Router is trying to register a Route with duplicate uid (route name which is already registered)', function() {
            var self = this;

            var app = self.appManager.buildApp(self.config, {name: '0'});
            var router1 = app.buildRouter({url: '/', version: 1});
            var router2 = app.buildRouter({url: '/group', version: 1});

            router1.buildRoute({
                name: 'get',
                type: 'get',
                url: '/'
            });


            function tCase() {
                router2.buildRoute({
                    name: 'get',
                    type: 'get',
                    url: '/'
                });
            }

            expect(tCase).to.throw(Error);
        });

        it('should throw an Error when we try to build an App with non-unique `name`', function() {
            var self = this;

            self.appManager.buildApp(self.config, {name: 'unique'});

            function tCase() {
                self.appManager.buildApp(self.config, {name: 'unique'});
            }

            expect(tCase).to.throw(Error);
        });
    });

    describe('methods', function() {
        beforeEach(function() {
            var app = this.app = this.appManager.buildApp(this.config, {name: '1'});

            this.preBuildSpy      = sinon.spy();
            this.postBuildSpy     = sinon.spy();
            this.statusChangedSpy = sinon.spy();
            this.preInitSpy       = sinon.spy();
            this.postInitSpy      = sinon.spy();
            this.unknownErrorSpy  = sinon.spy();
            this.errorSpy         = sinon.spy();

            app.on('pre-build', this.preBuildSpy);
            app.on('post-build', this.postBuildSpy);
            app.on('status-changed', this.statusChangedSpy);
            app.on('pre-init', this.preInitSpy);
            app.on('post-init', this.postInitSpy);
            app.on('unknown-error', this.unknownErrorSpy);
            app.on('error', this.errorSpy);

            this.appEmitSpy = sinon.spy(app, 'emit');

            this.config.set('couchbase', {
                host: 'localhost',
                buckets: {
                    main: {
                        bucket: 'main'
                    }
                }
            });

        });

        before(function() {
            this.matchers = {
                expressRouter: function routerMatcher(router) {
                    return Express.Router.isPrototypeOf(router);
                }
            };

            this.nextTick = function(callback) {
                return new Promise(function(resolve, reject) {
                    process.nextTick(function() {
                        try {
                            callback();
                            resolve();
                        } catch(e) {
                            reject(e);
                        }
                    });
                });
            };
        });

        afterEach(function() {
            delete this.app;

            this.appEmitSpy.restore();
        });

        describe('on', function() {
            it('should throw an error when we try to bind more than one listener for the `unknown-error` event', function() {
                var app = this.app;

                //we have already assigned one listener in the "before" hook
                expect(bindListener).to.throw(Error);

                function bindListener() {
                    app.on('unknown-error', function() {
                        return;
                    });
                }
            });

            it('should call registered listeners when we emit an event', function() {
                var app = this.app;

                app.emit('unknown-error');
                app.emit('unknown-error');

                this.unknownErrorSpy.should.have.been.calledTwice;
            });
        });

        describe('$setStatus', function() {
            it('should fail silently when we try to change status of an app which is in ERROR state', function() {
                var self = this;
                var app = this.app;

                app.$setStatus(AppStatus.ERROR, new Error('test error'));

                return this.nextTick(function() {
                    self.statusChangedSpy.reset();
                    app.$setStatus(AppStatus.OK);
                }).should.be.fulfilled.then(function() {
                    self.statusChangedSpy.should.have.callCount(0);
                });
            });

            it('should change the status/state of the app', function() {
                var app = this.app;

                return this.nextTick(function() {
                    app.$setStatus(AppStatus.OK);
                }).should.be.fulfilled.then(function() {
                    app.status.should.be.equal(AppStatus.OK);
                });
            });

            it('should emit the `status-changed` event', function() {
                var self = this;
                var app = this.app;

                self.statusChangedSpy.reset();

                return this.nextTick(function() {
                    app.$setStatus(AppStatus.OK);
                }).should.be.fulfilled.then(function() {
                    self.statusChangedSpy.should.have.been.calledOnce;
                    self.statusChangedSpy.should.have.been.calledWith(AppStatus.OK);
                });
            });
        });

        describe('$init', function() {
            it('should emit `pre-init` event', function() {
                this.preInitSpy.should.have.been.calledOnce;
            });

            it('should emit `pre-init` event', function() {
                this.postInitSpy.should.have.been.calledOnce;
            });
        });

        describe('useSession', function() {
            it('should connect Session middlewares to express app', function() {
                this.config.set('session', {});
                var appUseSpy = sinon.spy(this.app, 'use');
                var memcachedMock = new MemcachedStoreMock();

                this.app.useSession(memcachedMock);

                //TODO verify that actuall session middleware was provided to the function
                sinon.assert.alwaysCalledWith(appUseSpy, sinon.match.func);
                appUseSpy.calledTwice;
            });
        });

        describe('use', function() {
            it('should behave like the express.use method', function() {
                var useSpy = sinon.spy(this.app.expressApp, 'use');
                var args = [
                    '/some/path',
                    function() {}
                ];

                var returnVal = this.app.use.apply(this.app, args);

                useSpy.should.have.been.calledOnce;
                useSpy.should.have.been.calledWithExactly.apply(useSpy.should.have.been, args);
                returnVal.should.be.equal(useSpy.getCall(0).returnValue);
            });
        });

        describe('getRoute', function() {
            beforeEach(function() {
                this.app = this.appManager.buildApp(this.config, {name: 'getRouteTest'});

                this.app.buildRouter({
                    url: '/',
                    version: 1
                }).buildRoute({
                    type: 'get',
                    url: '/test'
                });
            });

            it('should return Route object', function() {
                this.app.getRoute('getTest_v1.0').should.be.instanceof(Route);
            });

            it('should throw Error when Route with gived uid is not found', function() {
                var app = this.app;

                expect(function() {
                    app.getRoute('nonExistingUid');
                }).to.throw(Error);
            });
        });

        describe('getHost', function() {
            beforeEach(function() {
                this.config = new Config.Config();
                this.config.set(null, {baseUrl: 'http://service.bistudio.com/root'});
                this.app = this.appManager.buildApp(this.config, {name: 'getHost'});
            });

            it('should return base app location string (protocol + host)', function() {
                this.app.getHost().should.be.equal('http://service.bistudio.com');
            });
        });

        describe('$buildExpressRouter', function() {
            it('should return new express Router object', function() {
                var router = this.app.$buildExpressRouter();
                expect(this.matchers.expressRouter(router)).to.be.true;
            });
        });

        describe('buildRouter', function() {
            it('should be instance of Router', function() {
                this.app.buildRouter({url: '/'}).should.be.an.instanceof(Router);
            });

            it('should be instance of app.Router', function() {
                this.app.buildRouter({url: '/'}).should.be.an.instanceof(this.app.Router);
            });

            it("should push new Router object to it's stack", function() {
                var router = this.app.buildRouter({url: '/'});
                this.app.routers.should.include(router);
            });

            it("should emit `build-router` event with a new Router", function() {
                var router = this.app.buildRouter({url: '/'});
                this.appEmitSpy.withArgs('build-router', router).should.have.been.calledOnce;
            });
        });

        describe('build', function() {
            it('should return self (app)', function() {
                this.app.build().should.be.equal(this.app);
            });

            it('should emit pre-build event', function() {
                var self = this;
                var app = this.app;

                app.build();

                return this.nextTick(function() {
                    self.preBuildSpy.should.have.been.calledOnce;
                    self.preBuildSpy.should.have.been.calledWith(app);
                }).should.be.fulfilled;
            });

            it('should emit post-build event', function() {
                var self = this;
                var app = this.app;

                app.build();

                return this.nextTick(function() {
                    self.postBuildSpy.should.have.been.calledOnce;
                    self.postBuildSpy.should.have.been.calledWith(app);
                }).should.be.fulfilled;
            });

            it("should assign app`s routers to the express object", function() {
                var self = this;
                var buildExpressRouterSpy = sinon.spy(Router.prototype, '$buildExpressRouter');
                var expressUseSpy = sinon.spy(this.app.expressApp, 'use').withArgs(
                    sinon.match.string,
                    sinon.match(this.matchers.expressRouter)
                );

                this.app.buildRouter({url: '/'});
                this.app.buildRouter({url: '/group'});
                this.app.buildRouter({url: '/user'});

                this.app.build();

                return this.nextTick(function() {
                    buildExpressRouterSpy.should.have.been.calledThrice;
                    expressUseSpy.withArgs(
                        sinon.match.string,
                        sinon.match(self.matchers.expressRouter)
                    ).should.have.been.calledThrice;

                    expressUseSpy.should.have.been.calledWith('/');
                    expressUseSpy.should.have.been.calledWith('/group');
                    expressUseSpy.should.have.been.calledWith('/user');
                });
            });

            [
                {
                    baseUrl: '127.0.0.1:3000/root/path',
                    routerUrl: '/user',
                    expectedBinding: '/root/path/user'
                },
                {
                    baseUrl: 'api.domain.com/root/path/',
                    routerUrl: '/user',
                    expectedBinding: '/root/path/user'
                },
                {
                    baseUrl: 'http://api.domain.com/root/path/',
                    routerUrl: '/user',
                    expectedBinding: '/root/path/user'
                },
                {
                    baseUrl: 'https://127.0.0.1:3000',
                    routerUrl: '/user',
                    expectedBinding: '/user'
                },
                {
                    baseUrl: '127.0.0.1:3000',
                    routerUrl: '/user',
                    expectedBinding: '/user'
                }
            ].forEach(function(data, index) {
                it(`should attach all routers to the root path when \`baseUrl\` config value is provided (${index})`, function() {
                    var config = new Config.Config();
                    config.set(null, {
                        baseUrl: data.baseUrl
                    });

                    var app = this.appManager.buildApp(config, {
                        name: Date.now() + index
                    });

                    var expressUseSpy = sinon.spy(app.expressApp, 'use').withArgs(
                        sinon.match.string,
                        sinon.match(this.matchers.expressRouter)
                    );

                    app.buildRouter({url: data.routerUrl});
                    app.build();

                    return this.nextTick(function() {
                        expressUseSpy.should.have.been.calledWith(data.expectedBinding);
                    });
                });
            });
        });

        describe('$getTimeoutInterval', function() {
            it('should return `request:timeout` config value', function() {
                this.config.set('request:timeout', 5000);
                this.app.$getTimeoutInterval(10000).should.be.equal(5000);
            });

            it('should return received default value if the request:timeout config option is not set', function() {
                this.config.set('request:timeout', undefined);
                this.app.$getTimeoutInterval(10000).should.be.equal(10000);
            });
        });

        describe('listen', function() {
            afterEach(function(done) {
                this.app.server.close(function(err) {
                    done(err);
                });
            });

            it('should call the http.Server.listen method', function() {
                var server = new Server;
                var spy = sinon.spy(server, 'listen');
                var stub = sinon.stub(http, 'createServer').returns(server);

                this.app.listen('80', '127.0.0.1', 500, {ssl: false});

                spy.should.have.been.calledOnce;
                spy.should.have.been.calledWithExactly('80', '127.0.0.1', 500);

                stub.restore();
            });

            it('should call the http.Server.setTimeout method', function() {
                var server = new Server;
                var spy = sinon.spy(server, 'setTimeout');
                var stub = sinon.stub(http, 'createServer').returns(server);

                this.app.listen('80', '127.0.0.1', 500, {ssl: false});

                spy.should.have.been.calledOnce;
                spy.should.have.been.calledWithExactly(10000);

                stub.restore();
            });

            //it('should return new instance of http Server', function(done) {
                //this.app.once('listening', function() {
                    //done();
                //});

                //var server = this.app.listen('0.0.0.0');
                //server.should.be.an.instanceof(http.Server);
            //});

            //it('should return new instance of https Server', function() {
                //var server = this.app.listen('0.0.0.0', {ssl: true});
                //server.should.be.an.instanceof(https.Server);
            //});

            it('should throw an Error if we try to call listen more than once', function(done) {
                this.app.once('listening', function() {
                    expect(this.listen.bind(this, '127.0.0.1:9998')).to.throw(Error);
                    done();
                });
                this.app.listen('127.0.0.1:9998');
            });

            it('should emit the `listening` event', function(done) {
                var self = this;
                this.app.on('error', function(err) {
                    return done(err);
                });

                this.app.once('listening', function(app) {
                    app.should.be.equal(self.app);
                    return done();
                });

                this.app.listen('127.0.0.1:9998');
            });

            it('should emit the `error` event on server error', function(done) {
                var loggerStub = sinon.stub(logger, 'error');

                var server = this.app.listen('127.0.0.1:9998');

                this.app.once('error', function(err) {
                    err.should.be.an.instanceof(Error);
                    loggerStub.restore();
                    return done();
                });

                this.app.once('listening', function() {
                    server.emit('error', new Error('test error'));
                })
            });
        });

        describe('close', function() {

            it('should close active server (app) which is listening for connections', function(done) {
                this.app.on('listening', function(app) {
                    app.server.listening.should.be.equal(true);
                    this.close().should.be.fulfilled.then(function() {
                        app.server.listening.should.be.equal(false);
                    }).should.notify(done);
                });

                this.app.listen('127.0.0.1:9998');
            });

            it('should return resolved promise when the app (server) is not listening for connections (aka already closed)', function() {
                expect(this.app.server).to.be.equal(null);
                return this.app.close().should.be.fulfilled;
            });

            it('should return rejected promise with an error when the `server.close` method yields the Error', function(done) {
                var error = new Error('test error');

                this.app.on('listening', function(app) {
                    app.server.listening.should.be.equal(true);
                    var serverCloseStub = sinon.stub(app.server, 'close').yields(error);

                    this.close().should.be.rejected.then(function(err) {
                        err.should.be.equal(error);
                        serverCloseStub.restore();
                        return app.close();
                    }).should.notify(done);
                });

                this.app.listen('127.0.0.1:9998');
            });
        });
    });

});
