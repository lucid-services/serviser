var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var Express        = require('express');

var AppManager = require('../../../lib/express/appManager.js');
var Router     = require('../../../lib/express/router.js');
var Route      = require('../../../lib/express/route.js');
var RouterError= require('../../../lib/error/routerError.js');
var Config     = require('../mocks/config.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('Router', function() {

    before(function() {
        this.models = {odm: {}, orm: {}};
        this.config = new Config();

        this.appManager = new AppManager(this.config, this.models);
        var app = this.app = this.appManager.buildApp();

        this.matchers = {
            expressRouter: function routerMatcher(router) {
                return Express.Router.isPrototypeOf(router);
            }
        };
    });

    after(function() {
        delete this.models;
        delete this.config;
        delete this.appManager;
        delete this.app;
    });

    beforeEach(function() {
        this.router = this.app.buildRouter({
            url: '/',
            routeNameFormat: '{method}{Name}'
        });
    });

    afterEach(function() {
        this.app.routers.splice(this.app.routers.indexOf(this.router), 1);
    });

    it("should throw a RouterError if we don't provide an url", function() {
        var self = this;

        function test() {
            self.app.buildRouter();
        }

        expect(test).to.throw(RouterError);
    });

    it('should call the `$normalizeUrl` method', function() {
        var url = '/some/endpint';
        var spy = sinon.spy(Router.prototype, '$normalizeUrl');
        this.app.buildRouter({ url: url });

        spy.should.have.been.calledOnce;
        spy.should.have.been.calledWithExactly(url);

        spy.restore();
    });

    describe('setRouteNameFormat', function() {
        it('should set given option value', function() {
            var format = '{method}{Name}_test_{version}';
            this.router.setRouteNameFormat(format);
            this.router.options.routeNameFormat.should.be.equal(format);
        });
    });

    describe('$normalizeUrl', function() {
        it('should ensure that given url starts with "/" character', function() {
            var url = 'some/url/string';
            var normalized = this.router.$normalizeUrl(url);
            normalized.should.be.equal('/' + url);
        });

        it("should ensure that given url doesn't end with trailing '/' character", function() {
            var url = '/some/url/string/';
            var normalized = this.router.$normalizeUrl(url);
            normalized.should.be.equal(url.substring(0, url.length -1));
        });

        it('should replace multiple consecutive occurances of "/" character with single one', function() {
            var url = '//some//url/string';
            var normalized = this.router.$normalizeUrl(url);
            normalized.should.be.equal('/some/url/string');
        });

        it('should replace {version} placehoder with actual version string', function() {
            this.router.options.version = '1.0.0';
            var url = '/{version}/some/url/string';
            var normalized = this.router.$normalizeUrl(url);
            normalized.should.be.equal('/v1.0.0/some/url/string');
        });

        it('should remove {version} placeholder if a router version is not set', function() {
            var url = '/{version}/some/url/string';
            var normalized = this.router.$normalizeUrl(url);
            normalized.should.be.equal('/some/url/string');
        });
    });

    describe('$getVersionString', function() {
        it('should return empty string if the version of a router is not set', function() {
            var version = this.router.$getVersionString();
            version.should.be.equal('');
        });

        it('should return version string in fixed format', function() {
            this.router.options.version = '1.2.3'
            var version = this.router.$getVersionString();
            version.should.be.equal('v1.2.3');
        });

        it('should return version string in fixed format (case 2)', function() {
            this.router.options.version = 1.0
            var version = this.router.$getVersionString();
            version.should.be.equal('v1.0');
        });
    });

    describe('getUrl', function() {
        it('should return the url of a router', function() {
            this.router.getUrl().should.be.equal(this.router.options.url);
        });
    });

    describe('buildRoute', function() {
        beforeEach(function() {
            this.buildRouteSpy = sinon.spy();
            this.router.on('build-route', this.buildRouteSpy);
            this.route = this.router.buildRoute({
                url: '/',
                type: 'get'
            });
        });

        it('should return new instance of Route', function() {
            this.route.should.be.instanceof(Route);
        });

        it('should return new instance of router.Route', function() {
            this.route.should.be.instanceof(this.router.Route);
        });

        it('should emit the `build-route` event with new route object', function() {
            this.buildRouteSpy.should.have.been.calledOnce;
            this.buildRouteSpy.should.have.been.calledWith(this.route);
        });

        it("should add builded route to it's (router's) routes stack", function() {
            this.router.routes.should.include(this.route);
        });
    });

    describe('$buildExpressRouter', function() {
        it('should return new express.Router object', function() {
            var router = this.router.$buildExpressRouter();
            expect(this.matchers.expressRouter(router)).to.be.true;
        });

        it('should call the `build` method on every Route object create from the Router', function() {
            var routeBuildSpy = sinon.spy(Route.prototype, 'build');

            this.router.buildRoute({url: '/', type: 'get'});
            this.router.buildRoute({url: '/user', type: 'get'});
            this.router.buildRoute({url: '/user/apps', type: 'get'});

            var expressRouter = this.router.$buildExpressRouter();

            routeBuildSpy.should.have.been.calledThrice;
            routeBuildSpy.should.always.have.been.calledWith(expressRouter);
        });
    });
});
