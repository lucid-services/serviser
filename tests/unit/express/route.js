var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var Express        = require('express');
var Validator      = require('json-inspector');
var Promise        = require('bluebird');

var AppManager = require('../../../lib/express/appManager.js');
var Router     = require('../../../lib/express/router.js');
var Route      = require('../../../lib/express/route.js');
var RouteError = require('../../../lib/error/routeError.js');
var Config     = require('../mocks/config.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('Route', function() {

    before(function() {
        this.models = {odm: {}, orm: {}};
        this.config = new Config();

        this.appManager = new AppManager(this.models);
        var app = this.app = this.appManager.buildApp(this.config);

        this.buildRoute = function(routerOptions, routeOptions) {
            var router = this.app.buildRouter(routerOptions);
            return router.buildRoute(routeOptions);
        }

    });

    after(function() {
        delete this.models;
        delete this.config;
        delete this.appManager;
        delete this.app;
    });

    describe('constructor', function() {
        before(function() {
            this.router = this.app.buildRouter({url: '/', version: 1.0});
        });

        after(function() {
            this.app.routers.splice(this.app.routers.indexOf(this.router), 1);
            delete this.router;
        });

        it("should throw a RouteError if we don't provide an url in constructor options object", function() {
            var self = this;

            function test() {
                self.router.buildRoute({type: 'get'});
            }

            expect(test).to.throw(RouteError);
        });

        it("should throw a RouteError if we don't provide url type (http method)", function() {
            var self = this;

            function test() {
                self.router.buildRoute({url: '/'});
            }

            expect(test).to.throw(RouteError);
        });

        it('should call the `Router.$normalizeUrl` method', function() {
            var url = 'some/endpoint';
            var spy = sinon.spy(this.router, '$normalizeUrl');
            var route = this.router.buildRoute({url: url, type: 'get'});

            spy.should.have.been.calledOnce;
            spy.should.have.been.calledWithExactly(url);
            route.options.url.should.be.equal('/some/endpoint')

            spy.restore();
        });

        it('should call the `$formatUid` method', function() {
            var spy = sinon.spy(Route.prototype, '$formatUid');
            var route = this.router.buildRoute({url: '/', type: 'get'});

            spy.should.have.been.calledOnce;
            spy.should.have.been.calledWithExactly(
                this.router.options.routeNameFormat
            );
            route.uid.should.be.a('string');

            spy.restore();
        });
    });

    describe('getName', function() {
        it("should return route's name", function() {
            var route = this.buildRoute({
                url: '/',
                version: '1.0'
            }, {
                url: '/test',
                type: 'get',
                name: 'test'
            });

            route.getName().should.be.equal('test');
        });

        describe("default route's name (should be created if route name is not explicitly set)", function() {

            before(function() {
                var self = this;
                this.getNameForRoute = getNameForRoute;

                function getNameForRoute(urls) {
                    var route = self.buildRoute({
                        url: urls[0],
                        version: 1.0
                    }, {
                        url: urls[1],
                        type: 'get'
                    });

                    return route.getName();
                };

                this.shouldNotIncludeKeywordsInRouteNames = function(routeUrls, keywords) {
                    routeUrls.forEach(function(urlPairs) {
                        var name = getNameForRoute(urlPairs);
                        keywords.forEach(function(keyword) {
                            name.should.not.include(keyword);
                        });
                    });
                }
            });

            it('should not include `api` keyword in returned name', function() {
                this.shouldNotIncludeKeywordsInRouteNames([
                    ['/api/s2s/v1.0/user', '/apps/:app']
                ], [
                    'api',
                    'Api',
                    'API'
                ]);
            });

            it('should not include `s2s` keyword in returned name', function() {
                this.shouldNotIncludeKeywordsInRouteNames([
                    ['/api/s2s/v1.0/user', '/apps/:app']
                ], [
                    's2s',
                    'S2s',
                    'S2S'
                ]);
            });

            it('should not include `{version}` placeholder in returned name', function() {
                this.shouldNotIncludeKeywordsInRouteNames([
                    ['/api/s2s/{version}/user', '/apps/:app']
                ], [
                    '{version}',
                    '{Version}',
                    '{VERSION}'
                ]);
            });

            it('should not include version string in returned name', function() {
                this.shouldNotIncludeKeywordsInRouteNames([
                    ['/api/s2s/v1.0/user', '/apps/:app'],
                    ['/api/s2s/{version}/user', '/apps/:app']
                ], [
                    'v1.0'
                ]);
            });

            it('should not include express placeholders in returned name', function() {
                this.shouldNotIncludeKeywordsInRouteNames([
                    ['/api/s2s/v1.0/user', '/apps/:app'],
                    ['/api/s2s/{version}/user:userId', '/apps']
                ], [
                    ':app',
                    ':userId'
                ]);
            });

            it("should return route's default name ", function() {
                var name = this.getNameForRoute([
                    '/api/s2s/v1.0/user',
                    '/apps/:app'
                ]);

                name.should.be.equal('UserApps');
            });
        });
    });

    describe('$formatUid', function() {

        it("should return route's uid formated according to provided schema", function() {
            var self = this;

            var data = [
                {
                    routerOptions: {
                        url: '/api/s2s/{version}/user',
                        version: '1.2',
                        routeNameFormat: '{method}{Name}_s2s_{version}'
                    },
                    routeOptions: {
                        url: '/apps',
                        type: 'get'
                    },
                    expectedUid: 'getUserApps_s2s_v1.2'
                },
                {
                    routerOptions: {
                        url: '/api/user',
                        routeNameFormat: '{method}{Name}'
                    },
                    routeOptions: {
                        url: '/profile/private',
                        type: 'put',
                        name: 'updateProfile'
                    },
                    expectedUid: 'putUpdateProfile'
                },
                {
                    routerOptions: {
                        url: '/api/{version}/group',
                        version: '2.2',
                        routeNameFormat: '{method}_{name}_{version}'
                    },
                    routeOptions: {
                        url: '/post',
                        type: 'post'
                    },
                    expectedUid: 'post_groupPost_v2.2'
                },
            ];

            data.forEach(function(data, index) {
                var route = self.buildRoute(data.routerOptions, data.routeOptions);
                route.$formatUid(route.Router.options.routeNameFormat)
                    .should.be.equal(data.expectedUid, 'Dataset index: ' + index);
            });
        });

        it('should throw a RouteError when expected data is missing and route uid can not has specified format', function() {

            var self = this;

            var data = [
                {
                    routerOptions: {
                        url: '/api/s2s/{version}/user',
                        routeNameFormat: '{method}{Name}_s2s_{version}'
                    },
                    routeOptions: {
                        url: '/apps',
                        type: 'get'
                    }
                },
            ];

            data.forEach(function(data, index) {
                var stub = sinon.stub(Route.prototype, '$formatUid').returns('');
                var route = self.buildRoute(data.routerOptions, data.routeOptions);
                stub.restore();

                function test() {
                    route.$formatUid(route.Router.options.routeNameFormat);
                }
                expect(test).to.throw(RouteError);
            });
        });
    });

    describe('main', function() {
        beforeEach(function() {
            this.route = this.buildRoute({
                url: '/',
                version: 1.0
            }, {
                url: '/',
                type: 'get'
            });

            this.middleware = function middleware() {};
        });

        it("should push provided middleware function to the route's stack", function() {
            this.route.main(this.middleware);
            this.route.steps.should.include({
                name: 'main', fn: this.middleware
            });
        });

        it("should add provided middleware function to the route's dictionary", function() {
            this.route.main(this.middleware);
            this.route.stepsDict.should.have.property('main', this.middleware);
        });
    });

    describe('validate', function() {
        before(function() {
            this.validatorMiddlewareStub = sinon.stub();
            this.validatorStub = sinon.stub(Validator, 'getExpressMiddleware')
                .returns(this.validatorMiddlewareStub);
        });

        after(function() {
            this.validatorStub.restore();
        });

        beforeEach(function() {
            this.route = this.buildRoute({
                url: '/',
                version: 1.0
            }, {
                url: '/',
                type: 'get'
            });

            this.schema = {
                $is: String
            };
        });

        it("should push promise based function middleware to the route's stack", function() {
            this.route.steps.should.be.eql([]);
            this.route.validate(this.schema, 'query');

            var step = this.route.steps[0];
            step.name.should.be.equal('validator');
            step.fn.should.be.a('function');
        });

        it("should add promise based function middleware to the route's dictionary", function() {
            this.route.stepsDict.should.be.eql({});
            this.route.validate(this.schema, 'query');

            this.route.stepsDict.should.have.property('validator').that.is.a('function');
        });

        it('should create transformed validator middleware which returns a Promise', function() {
            var req = {};
            var res = {};

            this.validatorMiddlewareStub.yields();
            this.route.validate(this.schema, 'query');
            var middleware = this.route.stepsDict.validator;
            return middleware(req, res).should.be.fulfilled;
        });

        it('should return rejected Promise', function() {
            var req = {};
            var res = {};
            var err = new Error('test');

            this.validatorMiddlewareStub.yields(err);
            this.route.validate(this.schema, 'query');
            var middleware = this.route.stepsDict.validator;
            return middleware(req, res).should.be.rejectedWith(err);
        });
    });

    describe('restrictByClient', function() {
        beforeEach(function() {
            this.route = this.buildRoute({
                url: '/',
                version: 1.0
            }, {
                url: '/',
                type: 'get'
            });

            this.clientMiddlewareSpy = sinon.spy(this.route, '$clientMiddleware');
        });

        afterEach(function() {
            this.clientMiddlewareSpy.restore();
        });

        it('should call route.$clientMiddleware builder function with provided options object', function() {
            var options = {};

            this.route.restrictByClient(options);

            this.clientMiddlewareSpy.should.have.been.calledOnce;
            this.clientMiddlewareSpy.should.have.been.calledWith(options);
        });

        it("should push client middleware with provided options to the route's stack", function() {
            this.route.restrictByClient();

            this.route.steps.should.include({
                name: 'client', fn: this.clientMiddlewareSpy.firstCall.returnValue
            });
        });

        it("should add client middleware with provided options to the route's dictionary", function() {
            this.route.restrictByClient();

            this.route.steps.should.include({
                name: 'client', fn: this.clientMiddlewareSpy.firstCall.returnValue
            });
        });
    });

    describe('restrictByIp', function() {
        beforeEach(function() {
            this.route = this.buildRoute({
                url: '/',
                version: 1.0
            }, {
                url: '/',
                type: 'get'
            });

            this.restrictIpMiddlewareSpy = sinon.spy(this.route, '$restrictIpMiddleware');            
        });

        afterEach(function() {
            this.restrictIpMiddlewareSpy.restore();            
        });

        it('should call route.$restrictIpMiddleware builder function', function() {

            this.route.restrictByIp();
            this.restrictIpMiddlewareSpy.should.have.been.calledOnce;            
        });

        it("should push restrict ip middleware to the route's stack", function() {

            this.route.restrictByIp();
            this.route.stepsDict.should.have.property('restrictIp').that.is.a('function');
        });

        it("should add restrict ip middleware to the route's dictionary", function() {
            this.route.restrictByIp();

            this.route.steps.should.include({
                name: 'restrictIp', fn: this.restrictIpMiddlewareSpy.firstCall.returnValue
            });
        });
    });

    describe('restrictByOrigin', function() {
        beforeEach(function() {
            this.route = this.buildRoute({
                url: '/',
                version: 1.0
            }, {
                url: '/',
                type: 'get'
            });
            
            this.restrictOriginMiddlewareSpy = sinon.spy(this.route, '$restrictOriginMiddleware');
        });

        afterEach(function() {            
            this.restrictOriginMiddlewareSpy.restore();
        });

        it('should call route.$restrictOriginMiddleware builder function', function() {

            this.route.restrictByOrigin();
            this.restrictOriginMiddlewareSpy.should.have.been.calledOnce;
        });

        it("should push restrict origin middleware to the route's stack", function() {
            this.route.restrictByOrigin();

            this.route.stepsDict.should.have.property('restrictOrigin').that.is.a('function');
        });

        it("should add restrict origin middleware to the route's dictionary", function() {
            this.route.restrictByOrigin();

            this.route.steps.should.include({
                name: 'restrictOrigin', fn: this.restrictOriginMiddlewareSpy.firstCall.returnValue
            });
        });        
    });    

    describe('addStep', function() {
        beforeEach(function() {
            this.route = this.buildRoute({
                url: '/',
                version: 1.0
            }, {
                url: '/',
                type: 'get'
            });

            this.middleware = function() {};
        });

        it("should push provided middleware function to the route's stack", function() {
            this.route.addStep(this.middleware);
            this.route.steps.should.include({
                name: '1', fn: this.middleware
            });
        });

        it("should push provided NAMED middleware function to the route's stack", function() {
            this.route.addStep('name', this.middleware);
            this.route.steps.should.include({
                name: 'name', fn: this.middleware
            });
        });

        it("should add provided middleware function to the route's dictionary", function() {
            this.route.addStep(this.middleware);
            this.route.stepsDict.should.have.property('1', this.middleware);
        });

        it("should add provided NAMED middleware function to the route's dictionary", function() {
            this.route.addStep('name', this.middleware);
            this.route.stepsDict.should.have.property('name', this.middleware);
        });

        it('should throw a RouteError when we try to assign a middleware with duplicate name', function() {
            var self = this;
            function addStep() {
                self.route.addStep('name', self.middleware);
            }

            expect(addStep).to.not.throw(Error);
            expect(addStep).to.throw(RouteError);
        });
    });

    describe('getAllSteps', function() {
        before(function() {
            this.route = this.buildRoute({
                url: '/',
                version: '1.0'
            }, {
                url: '/',
                type: 'get'
            });
        });

        it("should return collection of route's middleware", function() {

            this.route.addStep(function() { });
            this.route.addStep(function() { });

            var steps = this.route.getAllSteps();

            steps.should.be.an.instanceof(Array);
            steps.should.have.lengthOf(2);
        });
    });

    describe('build', function() {
        beforeEach(function() {
            this.route = this.buildRoute({
                url: '/user',
                version: 1.0
            }, {
                url: '/apps',
                type: 'get'
            });

            this.expressRouter       = Express.Router();
            this.expressRouterGetSpy = sinon.spy(this.expressRouter, 'get');
        });

        afterEach(function() {
            this.expressRouterGetSpy.restore();
        });

        it("should call correct express method and route's url and a middleware function as arguments", function() {
            this.route.build(this.expressRouter);

            this.expressRouterGetSpy.should.have.been.calledOnce;
            this.expressRouterGetSpy.should.have.been.calledWithExactly(
                this.route.options.url, sinon.match.func
            );
        });

        it('should assign a middleware function to the express router object', function() {
            this.route.build(this.expressRouter);

            var middleware = this.expressRouterGetSpy.getCall(0).args.pop();
            middleware.should.be.a('function');
        });

        describe("route's middleware", function() {
            beforeEach(function() {
                this.req = {};
                this.res = {};
                this.next = sinon.spy();
            });

            it("should call express `next` callback when an error occurs", function() {
                var self = this;
                var error = new Error;
                var spy = sinon.spy();

                this.route.main(function() {
                    throw error;
                });
                this.route.addStep(spy);

                this.route.build(this.expressRouter);

                var middleware = this.expressRouterGetSpy.getCall(0).args.pop();

                return middleware(this.req, this.res, this.next).should.be.fulfilled.then(function() {
                    self.next.should.have.been.calledOnce;
                    self.next.should.have.been.calledWith(error);
                    spy.should.have.callCount(0);
                });
            });

            it('should return fulfilled promise', function() {
                var self = this;

                this.route.main(function() {});
                this.route.build(this.expressRouter);

                var middleware = this.expressRouterGetSpy.getCall(0).args.pop();

                return middleware(this.req, this.res, this.next).should.be.fulfilled.then(function() {
                    self.next.should.have.callCount(0);
                });
            });

            it('should call all registered steps (middlewares) with req, res object and correct context object', function() {
                var self = this;
                var middleware = sinon.spy();

                this.route.main(middleware);
                this.route.addStep(middleware);
                this.route.addStep(middleware);

                this.route.build(this.expressRouter);

                var routeMiddleware = this.expressRouterGetSpy.getCall(0).args.pop();

                return routeMiddleware(this.req, this.res, this.next).should.be.fulfilled.then(function() {
                    middleware.should.have.been.calledThrice;
                    middleware.should.have.been.calledWithExactly(self.req, self.res);
                });
            });

            it('should call all registered steps with correct context (this) object', function() {
                var self = this;
                var middleware = sinon.spy(function() {
                    this.should.have.property('route').that.is.equal(self.route);
                    this.should.have.property('app').that.is.equal(self.route.Router.App);
                });

                this.route.main(middleware);
                this.route.addStep(middleware);
                this.route.addStep(middleware);

                this.route.build(this.expressRouter);

                var routeMiddleware = this.expressRouterGetSpy.getCall(0).args.pop();

                return routeMiddleware(this.req, this.res, this.next).should.be.fulfilled;
            });

            it('should await for a Promise received from a middleware', function() {
                var self = this;
                var promiseSpy = sinon.spy();
                var middlewareSpy = sinon.spy();

                var middleware = sinon.spy(function() {
                    return new Promise(function(resolve, reject) {
                        setTimeout(function() {
                            promiseSpy();
                            return resolve();
                        }, 0);
                    });
                });

                this.route.main(middleware);
                this.route.addStep(middlewareSpy);

                this.route.build(this.expressRouter);

                var routeMiddleware = this.expressRouterGetSpy.getCall(0).args.pop();

                return routeMiddleware(this.req, this.res, this.next).then(function() {
                    promiseSpy.should.have.been.calledBefore(middlewareSpy);
                });
            });
        });
    });
});
