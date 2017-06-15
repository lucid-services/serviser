var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var Validator      = require('bi-json-inspector');
var Promise        = require('bluebird');

var AppManager        = require('../../../lib/express/appManager.js');
var Router            = require('../../../lib/express/router.js');
var Route             = require('../../../lib/express/route.js');
var Response          = require('../../../lib/express/response.js');
var RouteError        = require('../../../lib/error/routeError.js');
var RequestError      = require('../../../lib/error/requestError.js');
var ValidationError   = require('../../../lib/error/validationError.js');
var Config            = require('../mocks/config.js');

//should be required as it enables promise cancellation feature of bluebird Promise
require('../../../index.js');
//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('Route', function() {

    beforeEach(function() {
        this.models = {odm: {Client: {}}, orm: {}};
        this.config = new Config();

        this.appManager = new AppManager(this.models);
        var app = this.app = this.appManager.buildApp(this.config, {name: 'public'});

        this.buildRoute = function(routerOptions, routeOptions) {
            var router = app.buildRouter(routerOptions);
            return router.buildRoute(routeOptions);
        }

    });

    afterEach(function() {
        delete this.models;
        delete this.config;
        delete this.appManager;
        delete this.app;
    });

    describe('constructor', function() {
        beforeEach(function() {
            this.router = this.app.buildRouter({url: '/', version: 1.0});
        });

        afterEach(function() {
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

            spy.should.have.been.calledWithExactly(
                this.router.options.routeNameFormat
            );
            route.uid.should.be.a('string');

            spy.restore();
        });

        it('should set default `sdkMethodName` option value if we dont explicitly provide one', function() {
            var route = this.router.buildRoute({
                url: '/sdk',
                type: 'get'
            });

            route.description.sdkMethodName.should.be.equal('getSdk');
        });

        it('should accept `sdkMethodName` string option', function() {
            var route = this.router.buildRoute({
                url: '/sdk',
                type: 'get',
                sdkMethodName: 'someMethodName'
            });

            route.description.sdkMethodName.should.be.equal('someMethodName');
        });

        it('should accept `summary` & `desc` string options (for swagger doc)', function() {
            var route = this.router.buildRoute({
                url: '/',
                type: 'get',
                desc: 'description',
                summary: 'summary'
            });

            route.description.summary.should.be.equal('summary');
            route.description.description.should.be.equal('description');
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

            beforeEach(function() {
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
                    ['/api/s2s/{version}/owner', '/apps/:app']
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

    describe('getUrl', function() {
        before(function() {
            this.route = this.buildRoute({
                version: 1,
                url: '/path/to'
            }, {
                type: 'get',
                url: '/endpoint/{seg}/resource/{id}'
            });
        });

        it('should return route endpoint without host', function() {
            this.route.getUrl().should.be.equal('/path/to/endpoint/{seg}/resource/{id}');
        });

        it('should return route endpoint with replaced path segments', function() {
            this.route.getUrl({
                seg: 'seg',
                id: '1'
            }).should.be.equal('/path/to/endpoint/seg/resource/1');
        });

        it('should return route url with query parameters', function() {
            this.route.getUrl({
                seg: 'seg',
                id: '1'
            }, {key: 'value', another: 'queryvalue'}).should.be.equal(
                '/path/to/endpoint/seg/resource/1?key=value&another=queryvalue'
            );
        });
    });

    describe('getAbsoluteUrl', function() {

        beforeEach(function() {
            this.route = this.buildRoute({
                version: 1,
                url: '/path/to'
            }, {
                type: 'get',
                url: '/endpoint/{seg}/resource/{id}'
            });

            this.configGetStub = sinon.stub(this.config, 'get');
            this.configGetStub.withArgs('protocol').returns('http:');
            this.configGetStub.withArgs('host').returns('127.0.0.1:3000');
        });

        it('should return absolute route endpoint', function() {
            this.route.getAbsoluteUrl().should.be.equal('http://127.0.0.1:3000/path/to/endpoint/{seg}/resource/{id}');
        });

        it('should return absolute route endpoint with replaced path segments', function() {
            this.route.getAbsoluteUrl({
                seg: 'seg',
                id: '1'
            }).should.be.equal('http://127.0.0.1:3000/path/to/endpoint/seg/resource/1');
        });

        it('should return route url with query parameters', function() {
            this.route.getAbsoluteUrl({
                seg: 'seg',
                id: '1'
            }, {key: 'value', another: 'queryvalue'}).should.be.equal(
                'http://127.0.0.1:3000/path/to/endpoint/seg/resource/1?key=value&another=queryvalue'
            );
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

        it('should return self (Route object)', function() {
            this.route.main(this.middleware).should.be.equal(this.route);
        });
    });

    describe('catch', function() {
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

        it('should return self (Route object)', function() {
            this.route.main(sinon.spy());
            this.route.catch(sinon.spy()).should.be.equal(this.route);
        });

        it('should attach provided catch error handler to the last middleware in stack', function() {
            var catchFn = function(err, req, res) { };

            this.route.main(sinon.spy());
            this.route.catch(RouteError, catchFn);

            this.route.steps.pop().should.have.property('catch').that.is.eql([[RouteError, catchFn]]);
        });

        it('should normalize provided arguments for the catch method', function() {
            var catchFn = function(err, req, res) { };

            this.route.main(sinon.spy());
            this.route.catch(catchFn);

            this.route.steps.pop().should.have.property('catch').that.is.eql([[Error, catchFn]]);
        });

        it('should throw RouteError when we try to register `catch` error handler too early', function() {
            var self = this;

            function testCase() {
                self.route.catch(sinon.spy());
            }

            expect(testCase).to.throw(RouteError);
        });
    });

    describe('validate', function() {
        beforeEach(function() {
            this.validatorMiddlewareStub = sinon.stub();
            this.validatorStub = sinon.stub(Validator, 'getExpressMiddleware')
                .returns(this.validatorMiddlewareStub);
        });

        afterEach(function() {
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

        it('should create transformed validator middleware which returns a Promise', function() {
            var req = {};
            var res = {};

            this.validatorMiddlewareStub.yields();
            this.route.validate(this.schema, 'query');
            var middleware = this.route.steps[0].fn;
            return middleware(req, res).should.be.fulfilled;
        });

        it('should call `respondsWith` method with `ValidationError` constructor', function() {
            var respondsWithSpy = sinon.spy(this.route, 'respondsWith');

            this.route.validate(this.schema, 'query');
            respondsWithSpy.should.have.been.calledWith(ValidationError);

            respondsWithSpy.restore();
        });

        it('should return rejected Promise', function() {
            var req = {};
            var res = {};
            var err = new Error('test');

            this.validatorMiddlewareStub.yields(err);
            this.route.validate(this.schema, 'query');
            var middleware = this.route.steps[0].fn;
            return middleware(req, res).should.be.rejectedWith(err);
        });

        it('should return self (Route object)', function() {
            this.route.validate(this.schema, 'query').should.be.equal(this.route);
        });
    });

    describe('respondsWith', function() {
        beforeEach(function() {
            this.route = this.buildRoute({
                url: '/respondsWith',
                version: 1.0
            }, {
                url: '/',
                type: 'get'
            });
        });

        it('should assign provided response data schema to the route', function() {
            var schema = {
                some: {
                    data: {
                        $is: String
                    }
                }
            };

            this.route.respondsWith(schema);
            this.route.respondsWith(RequestError);

            this.route.description.responses.should.have.property('200').that.include({
                schema: schema
            });

            this.route.description.responses.should.have.property('400').that.include({
                schema: new RequestError
            });
        });

        it('should return self aka the route object', function() {
            this.route.respondsWith({$is: String}).should.be.equal(this.route);
        });

        it('should accept json-inspector schema in form of a Function', function() {
            var schema = function() {
                return {str: {$is: String}};
            };

            this.route.respondsWith(schema);

            this.route.description.responses.should.have.property('200').that.include({
                schema: schema
            });
        });

        it('should accept Error instance object', function() {
            var descriptor = new RequestError;
            this.route.respondsWith(descriptor);

            this.route.description.responses.should.have.property('400').that.include({
                schema: descriptor
            });
        });

        it('should overwrite existing schema if already set in case of successfull response (200)', function() {
            var schema = {$is: Number};
            var schema2 = {$is: String};
            this.route.respondsWith(schema);
            this.route.respondsWith(schema2);

            this.route.description.responses.should.have.property('200').that.include({
                schema: schema2
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

        it('should throw a RouteError when we try to assign a middleware with duplicate name', function() {
            var self = this;
            function addStep() {
                self.route.addStep('name', self.middleware);
            }

            expect(addStep).to.not.throw(Error);
            expect(addStep).to.throw(RouteError);
        });

        it('should return self (Route object)', function() {
            this.route.addStep(sinon.spy()).should.be.equal(this.route);
        });
    });

    describe('getAllSteps', function() {
        beforeEach(function() {
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

            var middleware = this.route.build();

            return middleware(this.req, this.res, this.next).should.be.fulfilled.then(function() {
                self.next.should.have.been.calledOnce;
                self.next.should.have.been.calledWith(error);
                spy.should.have.callCount(0);
            });
        });

        it("should trigger request response and stop furher processing of the request if we've got `Response` object as fulfillment value of a route middleware", function(done) {
            var self = this;
            var res = {
                redirect: sinon.spy()
            };
            var middlewareSpy = sinon.spy();

            this.route.main(function() {
                return this.route.buildResponse(function() {
                    this.redirect('https://google.com');
                });
            });
            this.route.addStep(middlewareSpy);
            this.route.addStep(middlewareSpy);
            var routeMiddleware = this.route.build();

            //promise will never get fulfilled or rejected as it will be cancelled
            var promise = routeMiddleware(this.req, res, this.next);
            setTimeout(function() {
                res.redirect.should.have.been.calledOnce;
                res.redirect.should.have.been.calledWith('https://google.com');
                middlewareSpy.should.have.callCount(0);
                self.next.should.have.callCount(0);

                done();
            }, 50);
        });

        it("should trigger request response and stop furher processing of the request if we've got `Response` object as fulfillment value of a route middleware (2)", function(done) {
            var self = this;
            var res = {
                redirect: sinon.spy()
            };

            this.route.main(function() {
                return this.route.buildResponse(function() {
                    this.redirect('https://google.com');
                });
            });
            var routeMiddleware = this.route.build(this.expressRouter);

            //promise will never get fulfilled or rejected as it will be cancelled
            var promise = routeMiddleware(this.req, res, this.next);
            setTimeout(function() {
                res.redirect.should.have.been.calledOnce;
                res.redirect.should.have.been.calledWith('https://google.com');
                self.next.should.have.callCount(0);
                done();
            }, 50);
        });

        it("should call registered route's catch error handler", function() {
            var self = this;
            var err = new RouteError('testinng error');
            var catchHandlerSpy = sinon.spy();
            var middlewareSpy = sinon.spy();

            this.route.main(function() {
                return Promise.reject(err);
            });
            this.route.addStep(middlewareSpy);

            this.route.catch(RouteError, catchHandlerSpy);
            var routeMiddleware = this.route.build(this.expressRouter);

            return routeMiddleware(this.req, this.res, this.next).should.be.fulfilled.then(function() {
                catchHandlerSpy.should.have.been.calledOnce;
                catchHandlerSpy.should.have.been.calledWith(err, self.req, self.res);
                middlewareSpy.should.have.callCount(0);
                self.next.should.have.callCount(0);
            });
        });

        it("should call registered route's catch error handler (2)", function() {
            var self = this;
            var err = new RouteError('testinng error');
            var catchHandlerSpy = sinon.spy();
            var middlewareSpy = sinon.spy();
            var mainMiddlewareSpy = sinon.spy();

            this.route.main(mainMiddlewareSpy);
            this.route.addStep(function() {
                throw err;
            });

            this.route.catch(catchHandlerSpy);
            var routeMiddleware = this.route.build(this.expressRouter);

            return routeMiddleware(this.req, this.res, this.next).should.be.fulfilled.then(function() {
                catchHandlerSpy.should.have.been.calledOnce;
                catchHandlerSpy.should.have.been.calledWith(err, self.req, self.res);
                mainMiddlewareSpy.should.have.callCount(1);
                mainMiddlewareSpy.should.have.been.calledWith(self.req, self.res);
                self.next.should.have.callCount(0);
            });
        });

        it('(catch function handler) should get correct req, res object arguments', function() {
            var self = this;
            var err = new RouteError('testinng error');
            var catchHandlerSpy = sinon.spy();
            var res1 = {statusCode: 200};
            var res2 = {statusCode: 301};
            var req1 = {};
            var req2 = {};

            this.route.addStep(function() {
                throw err;
            });

            this.route.catch(catchHandlerSpy);
            var routeMiddleware = this.route.build(this.expressRouter);

            return routeMiddleware(req1, res1, this.next).should.be.fulfilled.then(function() {
                catchHandlerSpy.should.have.been.calledOnce;
                var wrappedResponse = catchHandlerSpy.getCall(0).args[2];
                wrappedResponse.should.be.equal(res1);

                catchHandlerSpy.should.have.been.calledWith(
                    err,
                    sinon.match.same(req1),
                    wrappedResponse
                );
            }).then(function() {
                return routeMiddleware(req2, res2, this.next).should.be.fulfilled.then(function() {
                    var wrappedResponse = catchHandlerSpy.getCall(1).args[2];
                    wrappedResponse.should.be.equal(res2);

                    catchHandlerSpy.should.have.been.calledTwice;
                    catchHandlerSpy.should.have.been.calledWithExactly(
                        err,
                        sinon.match.same(req2),
                        wrappedResponse
                    );
                });
            });
        });

        it("should call registered route's error handler and redirect received error to the express error handler (via `next` callback)", function() {
            var self = this;
            var err = new RouteError('testinng error');
            var catchHandlerSpy = sinon.spy(function(err, res, res) {
                throw err;
            });
            var middlewareSpy = sinon.spy();

            this.route.main(function() {
                return Promise.reject(err);
            });
            this.route.addStep(middlewareSpy);

            this.route.catch(catchHandlerSpy);
            var routeMiddleware = this.route.build(this.expressRouter);

            return routeMiddleware(this.req, this.res, this.next).should.be.fulfilled.then(function() {
                catchHandlerSpy.should.have.been.calledOnce;
                catchHandlerSpy.should.have.been.calledWith(err, self.req, self.res);
                middlewareSpy.should.have.callCount(0);
                self.next.should.have.callCount(1);
                self.next.should.have.been.calledWith(err);
            });
        });

        it('should return fulfilled promise', function() {
            var self = this;

            this.route.main(function() {});
            var middleware = this.route.build(this.expressRouter);

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

            var routeMiddleware = this.route.build(this.expressRouter);

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

            var routeMiddleware = this.route.build(this.expressRouter);

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

            var routeMiddleware = this.route.build(this.expressRouter);

            return routeMiddleware(this.req, this.res, this.next).then(function() {
                promiseSpy.should.have.been.calledBefore(middlewareSpy);
            });
        });
    });
});
