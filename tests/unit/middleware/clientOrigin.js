var _              = require('lodash');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinon          = require('sinon');
var sinonChai      = require("sinon-chai");
var Validator      = require('bi-json-inspector');

chai.should();
chai.use(chaiAsPromised);

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var AppManager     = require('../../../lib/express/appManager.js');
var ForbiddenError = require('./../../../lib/error/forbiddenError.js');
var ServiceError   = require('./../../../lib/error/serviceError.js');
var Config         = require('../mocks/config.js');

describe('Route.prototype.restrictClientOrigin', function () {

    beforeEach(function() {
        var self = this;
        this.models = {};
        this.config = new Config();

        this.appManager = new AppManager(this.models);
        var app = this.app = this.appManager.buildApp(this.config, {name: '1'});
        this.router = app.buildRouter({url: '/', version: 1.0});

        this.buildClient = function(data) {
            return _.assign({
                id: '$aa81b716da75b5ba7129ad1c92f2698',
                secret: '$c80848cdc6c22b77d4a8ae9de520610'
            }, data);
        };

        this.route = this.router.buildRoute({
            type: 'get',
            url: '/'
        });

        this.res = {};
        this.req = {};
        this.next = sinon.spy();

        Validator.getExpressInjector(
            _.cloneDeep(this.app.options.validator)
        )(this.req, this.res, this.next);

        this.next.reset(); //because of the express validator injector
        this.validateDataSpy = sinon.spy(this.req.validator, 'validateData');
    });

    afterEach(function() {
        this.router.routes.splice(0, 1);
        this.validateDataSpy.restore();
    });

    it('should pass the Origin verification', function () {
        this.req.headers = { origin: 'http://correct' };
        this.req.client = this.buildClient({
            http_rules: {
                origin: [ /http:\/\/correct/ ]
            }
        });

        this.route.restrictClientOrigin();
        var fn = this.route.build();

        return fn(this.req, this.res, this.next).bind(this).then(function() {
            this.validateDataSpy.should.have.been.calledOnce;
            this.next.should.have.callCount(0); //no error occured
        });
    });

    it('should fail with `ForbiddenError` if Origin has not been supplied', function () {
        this.req.headers = {};
        this.req.client = this.buildClient({
            http_rules: {
                origin: [ /http:\/\/correct/ ]
            }
        });

        this.route.restrictClientOrigin();
        var fn = this.route.build();

        return fn(this.req, this.res, this.next).bind(this).then(function() {
            this.validateDataSpy.should.have.been.calledOnce;
            this.next.should.have.been.always.calledWithExactly(sinon.match.instanceOf(ForbiddenError));
        });
    });

    it('should fail with `ForbiddenError` if supplied Origin is incorrect', function () {
        this.req.headers = {origin: 'http://incorrect'};
        this.req.client = this.buildClient({
            http_rules: {
                origin: [ /http:\/\/correct/ ]
            }
        });

        this.route.restrictClientOrigin();
        var fn = this.route.build();

        return fn(this.req, this.res, this.next).bind(this).then(function() {
            this.validateDataSpy.should.have.been.calledOnce;
            this.next.should.have.been.always.calledWithExactly(sinon.match.instanceOf(ForbiddenError));
        });
    });

    it('should fail with `ServiceError` if client domains wasn\'t supplied', function () {
        this.req.headers = {origin: 'http://correct'};
        this.req.client = this.buildClient({
            http_rules: {}
        });

        this.route.restrictClientOrigin();
        var fn = this.route.build();

        return fn(this.req, this.res, this.next).bind(this).then(function() {
            this.validateDataSpy.should.have.callCount(0);
            this.next.should.have.been.always.calledWithExactly(sinon.match.instanceOf(ServiceError));
        });
    });
});
