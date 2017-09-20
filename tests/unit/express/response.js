var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var Promise   = require('bluebird');
var Config    = require('bi-config');

var Service    = require('../../../lib/service.js');
var Response   = require('../../../lib/express/response.js');
var AppManager = require('../../../lib/express/appManager.js');
var Router     = require('../../../lib/express/router.js');
var Route      = require('../../../lib/express/route.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('Response', function() {

    before(function() {
        this.res = {
            json: sinon.stub(),
            write: sinon.stub(),
            setHeader: sinon.stub(),
            req: {}
        };
    });

    after(function() {
        delete this.res;
    });

    describe('wrap', function() {
        it('should return new response object with additional methods', function() {
            this.res.should.not.have.property('filter');

            var res = Response.wrap(this.res);

            res.should.have.property('filter').that.is.a('function');
        });
    });

    describe('wrapped response object - (the object is provided to route method definitions)', function() {
        before(function() {
            this.models = {odm: {}, orm: {}};
            this.config = new Config.Config();
            this.config.set('baseUrl', 'http://127.0.0.1:3000');

            this.service = new Service(this.config);
            this.appManager = this.service.appManager;
            var app = this.app = this.appManager.buildApp(this.config, {name: '1'});
            this.router = this.app.buildRouter({url: '/test', version: 1.0});
        });

        beforeEach(function() {
            this.data = {
                prop: 'test',
                unexpectedProp: 'invalid'
            };
        });

        describe('setPaginationHeaders method', function() {
            before(function() {
                this.route = this.router.buildRoute({type: 'get', url: '/test0'});
                this.wrappedRes = Response.wrap(this.res, this.route);
            });

            it('should set valid Link response header', function() {
                this.wrappedRes.setPaginationHeaders({
                    offset: 0,
                    count: 100,
                    limit: 10
                });

                //TODO it's not ensured that url query parameters will be
                //inserted in correct order
                let firstUrl = this.route.getAbsoluteUrl({}, {
                    limit: 10,
                });
                let lastUrl = this.route.getAbsoluteUrl({}, {
                    limit: 10,
                    offset: 90,
                });
                let nextUrl = this.route.getAbsoluteUrl({}, {
                    offset: 10,
                    limit: 10
                });

                this.res.setHeader.should.have.been.calledTwice;
                this.res.setHeader.should.have.been.calledWith('x-total-count', 100);
                this.res.setHeader.should.have.been.calledWith(
                    'Link',
                    `<${firstUrl}>; rel="first", <${lastUrl}>; rel="last", <${nextUrl}>; rel="next"`
                );
            });

            it('should return response object', function() {
                this.wrappedRes.setPaginationHeaders({
                    offset: 0,
                    count: 100,
                    limit: 10
                }).should.be.equal(this.wrappedRes);
            });
        });

        describe('filter method', function() {

            describe('the route.respondsWith method is provided with registered validator name', function() {

                before(function() {
                    var validator = this.validator = this.app.getValidator();

                    validator.addSchema({
                        type: 'string',
                        format: 'email'
                    }, '#email');

                    sinon.spy(validator, 'validate');

                    this.route = this.router.buildRoute({type: 'get', url: '/test'});
                    this.route.respondsWith('#email');

                    this.data = 'email@email.com';

                    this.wrappedRes = Response.wrap(this.res, this.route);
                });

                it('should fetch a reponse validator schema from validator instance when we provide only the schema name (id), not the schema definition', function() {
                    this.wrappedRes.filter(this.data);
                    this.validator.validate.should.have.been.calledOnce;
                    this.validator.validate.should.have.been.calledWith('#email', this.data);
                });

                after(function() {
                    this.validator.validate.restore();
                });
            });

            describe('the route.respondsWith method is provided with schema definition dirrectly', function() {
                before(function() {
                    this.route = this.router.buildRoute({type: 'get', url: '/'});
                    this.route.respondsWith({
                        type: 'object',
                        required: ['prop'],
                        additionalProperties: false,
                        properties: {
                            prop: {
                                $desc: 'property description',
                                type: 'string'
                            }
                        }
                    });

                    this.wrappedRes = Response.wrap(this.res, this.route);
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

                it('should convert an object to JSON before the validation if non plain object is provided', function() {
                    var data = new Data;

                    this.wrappedRes.filter(data).json();
                    this.res.json.should.have.been.calledOnce;
                    this.res.json.should.have.been.calledWith(sinon.match(function(val) {
                        val.should.have.property('prop');
                        val.should.not.have.property('unexpectedProp');
                        return true;
                    }));

                    function Data() {
                        this.toJSON = function() {
                            return {
                                prop: 'test',
                                unexpectedProp: 'invalid'
                            };
                        }
                    }
                });

                it('should throw a ValidationError', function() {

                    var self = this;

                    function tCase() {
                        self.wrappedRes.filter(null).json();
                    }

                    expect(tCase).to.throw(Service.error.ValidationError);
                });

                describe('wrapped response object returned from the `filter` method', function() {
                    beforeEach(function() {
                        this.dataTargetedRes = this.wrappedRes.filter(this.data);
                        this.res.json.reset();
                    });

                    it('`json` method should always explicitly call original json method with filtered data', function() {
                        this.res.json.returns(this.dataTargetedRes);
                        expect(this.dataTargetedRes.json()).to.be.equal(this.dataTargetedRes);
                        this.res.json.should.have.been.calledWith(this.data);
                    });

                    it('`write` method should always explicitly call original json method with filtered data', function() {
                        this.res.json.returns(this.dataTargetedRes);
                        expect(this.dataTargetedRes.write()).to.be.equal(this.dataTargetedRes);
                        this.res.write.should.have.been.calledWith(this.data);
                    });
                });
            });

        });
    });
});
