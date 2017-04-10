var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var Validator      = require('bi-json-inspector');
var Promise        = require('bluebird');

var Response        = require('../../../lib/express/response.js');
var AppManager      = require('../../../lib/express/appManager.js');
var Router          = require('../../../lib/express/router.js');
var Route           = require('../../../lib/express/route.js');
var Config          = require('../mocks/config.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('Response', function() {

    before(function() {
        var validatorManager = new Validator.ValidatorManager();
        this.validatorManager = validatorManager;

        this.res = {
            json: sinon.stub(),
            write: sinon.stub(),
            req: {
                validatorManager: validatorManager
            }
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
            this.config = new Config();

            this.appManager = new AppManager(this.models);
            var app = this.app = this.appManager.buildApp(this.config, {name: '1'});
            this.router = this.app.buildRouter({url: '/', version: 1.0});
        });

        beforeEach(function() {
            this.data = {
                prop: 'test',
                unexpectedProp: 'invalid'
            };
        });

        describe('filter method', function() {

            describe('the route.respondsWith method is provided with registered validator name', function() {

                before(function() {
                    var validator = new Validator.Validator(
                        {$isEmail: {}},
                        {},
                        this.validatorManager
                    );
                    this.validatorManager.add('#email', validator);
                    sinon.spy(this.validatorManager, 'get');

                    this.route = this.router.buildRoute({type: 'get', url: '/test'});
                    this.route.respondsWith('#email');

                    this.data = 'email@email.com';

                    this.wrappedRes = Response.wrap(this.res, this.route);
                });

                it('should get a reponse validator schema from req.validatorManager when we provide only a validator name, not a schema definition', function() {
                    this.wrappedRes.filter(this.data);
                    this.validatorManager.get.should.have.been.calledOnce;
                    this.validatorManager.get.should.have.been.calledWith('#email');
                });

                after(function() {
                    this.validatorManager.get.restore();
                });
            });

            describe('the route.respondsWith method is provided with schema definition dirrectly', function() {
                before(function() {
                    this.route = this.router.buildRoute({type: 'get', url: '/'});
                    this.route.respondsWith({
                        $required: true,
                        prop: {
                            $is: String
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

                    expect(tCase).to.throw(Validator.ValidationError);
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
