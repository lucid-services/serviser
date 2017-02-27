var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var Validator      = require('bi-json-inspector');
var Promise        = require('bluebird');

var Response   = require('../../../lib/express/response.js');
var AppManager = require('../../../lib/express/appManager.js');
var Router     = require('../../../lib/express/router.js');
var Route      = require('../../../lib/express/route.js');
var Config     = require('../mocks/config.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('Response', function() {

    before(function() {
        this.res = {
            json: sinon.stub(),
            write: sinon.stub(),
        };
    });

    after(function() {
        delete this.res;
    });

    describe('wrap', function() {
        it('should return new response object which has the original object set as its prototype', function() {
            var res = Response.wrap(this.res);
            Object.getPrototypeOf(res).should.be.equal(this.res);
        });

        it('should return new response object with additional methods', function() {
            var res = Response.wrap(this.res);

            res.should.have.property('filter').that.is.a('function');
        });
    });

    describe('wrapped response object - (the object is provided to route method definitions)', function() {
        before(function() {
            this.models = {odm: {}, orm: {}};
            this.config = new Config();

            this.appManager = new AppManager(this.models);
            var app = this.app = this.appManager.buildApp(this.config);

            this.router = this.app.buildRouter({url: '/', version: 1.0});
            this.route = this.router.buildRoute({type: 'get', url: '/'});

            this.route.respondsWith({
                prop: {
                    $is: String
                }
            });

            this.wrappedRes = Response.wrap(this.res, this.route);
        });

        beforeEach(function() {
            this.data = {
                prop: 'test',
                unexpectedProp: 'invalid'
            };
        });

        describe('filter method', function() {
            it('should return new response object which has original response object set as its prototype', function() {
                var res = this.wrappedRes.filter({prop: 'test'});
                Object.getPrototypeOf(res).should.be.equal(this.res);
            });

            it('should throw an Error when the validation process fails', function() {
                var self = this;

                function testCase() {
                    self.wrappedRes.filter('invalid data string');
                }

                expect(testCase).to.throw(Error);
            });

            it('should throw an Error when response data schema is not set on the route', function() {
                var self = this;
                var descriptionBck = this.route.description;
                this.route.description = {
                    responses: {}
                };

                function testCase() {
                    self.wrappedRes.filter({prop: 'valid'});
                }

                expect(testCase).to.throw(Error);

                this.route.description = descriptionBck;
            });

            it('should filter provided data according to response data schema of a route object', function() {
                this.wrappedRes.filter(this.data);
                this.data.should.have.property('prop');
                this.data.should.not.have.property('unexpectedProp');
            });

            describe('wrapped response object returned from the `filter` method', function() {
                beforeEach(function() {
                    this.dataTargetedRes = this.wrappedRes.filter(this.data);
                });

                it('`json` method should always explicitly call original json method with filtered data', function() {
                    this.dataTargetedRes.json().should.be.equal(this.dataTargetedRes);
                    this.res.json.should.have.been.calledWith(this.data);
                });

                it('`write` method should always explicitly call original json method with filtered data', function() {
                    this.dataTargetedRes.write().should.be.equal(this.dataTargetedRes);
                    this.res.write.should.have.been.calledWith(this.data);
                });
            });
        });
    });
});
