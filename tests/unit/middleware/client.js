var _               = require('lodash');
var sinon           = require('sinon');
var chai            = require('chai');
var chaiAsPromised  = require('chai-as-promised');
var sinonChai       = require("sinon-chai");
var Promise         = require('bluebird');
var API_CODES       = require('bi-api-errors').DEPOT;
var BIServiceSDK    = require('bi-service-sdk').BIServiceSDK;
var SDKRequestError = require('bi-service-sdk').SDKRequestError;

var DepotSDK                = require('../mocks/depotSDK.js');
var UnauthorizedError       = require('../../../lib/error/unauthorizedError.js');
var ServiceError            = require('../../../lib/error/serviceError.js');
var clientMiddleware        = require('../../../lib/middleware/client.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('client middleware', function() {

    before(function() {
        this.res = {};
        this.req = {};
    });

    beforeEach(function() {
        this.req = {};
        this.depotSDKStub = new DepotSDK({baseURL: '127.0.0.1'});

        this.context = {
            route: {
                Router: {
                    App: {
                        storage: {},
                        sdk: {
                            privateDepot: {
                                'v1.0': this.depotSDKStub
                            }
                        }
                    }
                }
            }
        };

        this.requestGetStub = this.depotSDKStub.getServiceClient;

        this.clientRecord = {
            name: 'test1',
            id: '$aa81b716da75b5ba7129ad1c92f2698',
            secret: '$c80848cdc6c22b77d4a8ae9de520610',
            scopes: [
                'getUser_v1.0',
                'postUser_v1.0'
            ],
            http_rules: {
                ip: [ "127.0.0.1" ],
                origin: [ "^https://bistudio.com" ],
                redirect: [
                    "^https://bistudio.com",
                    "ylands.com$"
                ]
            }
        };
    });

    it('should fail with a ServiceError when the restrictScope option is enabled and the route does not have uid set', function() {
        var fn = clientMiddleware({restrictScope: true});
        var self = this;

        this.req.query = {
            client_id: this.clientRecord.id
        };

        this.context.route.uid = undefined;

        this.requestGetStub.returns(Promise.resolve({data: this.clientRecord}));

        return fn.call(this.context, this.req, this.res).should.be.rejectedWith(ServiceError);
    });

    it('should convert `http_rules` into RegExp objects', function() {
        var fn = clientMiddleware();
        var self = this;

        this.req.query = {
            client_id: this.clientRecord.id
        };

        this.context.route.uid = undefined;
        this.requestGetStub.returns(Promise.resolve({data: this.clientRecord}));

        return fn.call(this.context, this.req, this.res).should.be.fulfilled.then(function() {
            self.clientRecord.http_rules.ip.should.have.lengthOf(1);
            self.clientRecord.http_rules.origin.should.have.lengthOf(1);
            self.clientRecord.http_rules.redirect.should.have.lengthOf(2);

            self.clientRecord.http_rules.ip.forEach(function(ip) {
                ip.should.be.instanceof(RegExp);
            });

            self.clientRecord.http_rules.origin.forEach(function(url) {
                url.should.be.instanceof(RegExp);
            });

            self.clientRecord.http_rules.redirect.forEach(function(url) {
                url.should.be.instanceof(RegExp);
            });
        });
    });

    describe('clientSecret option', function() {
        it("should return fulfilled promise and successfully validate client's secret value", function() {
            var fn = clientMiddleware({clientSecret: true});
            var self = this;

            this.req.query = {
                client_id: this.clientRecord.id,
                client_secret: this.clientRecord.secret
            };
            this.context.route.uid = 'notRelevant';
            this.requestGetStub.returns(Promise.resolve({data: this.clientRecord}));

            return fn.call(this.context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.equal(self.clientRecord);
            });
        });

        it("should return fulfilled promise and successfully validate client's secret value (2)", function() {
            var clientSecretGetterSpy = sinon.spy(function(req) {
                return req.query.clientSecret;
            });

            var fn = clientMiddleware({clientSecret: clientSecretGetterSpy});
            var self = this;

            this.req.query = {
                client_id: this.clientRecord.id,
                clientSecret: this.clientRecord.secret
            };

            this.requestGetStub.returns(Promise.resolve({data: this.clientRecord}));
            this.context.route.uid = 'notRelevant';

            return fn.call(this.context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.equal(self.clientRecord);
                clientSecretGetterSpy.should.have.been.calledOnce;
                clientSecretGetterSpy.should.have.been.calledWith(self.req, self.res);
            });
        });

        it('should NOT fail when we pass invalid client secret value and the clientSecret option is disabled', function() {
            var fn = clientMiddleware({clientSecret: false});
            var self = this;

            this.req.query = {
                client_id: this.clientRecord.id,
                client_secret: 'some-invalid-value'
            };

            this.requestGetStub.returns(Promise.resolve({data: this.clientRecord}));
            this.context.route.uid = 'notRelevant';

            return fn.call(this.context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.equal(self.clientRecord);
            });
        });

        it('should fetch data from correct target, (dataDestinations option)', function() {
            var fn = clientMiddleware(); //dataDestionations options defaults to: headers, query, body
            var self = this;

            this.req.headers = {
                'client-id': this.clientRecord.id,
            };

            this.requestGetStub.returns(Promise.resolve({data: this.clientRecord}));
            this.context.route.uid = 'notRelevant';

            return fn.call(this.context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.equal(self.clientRecord);
            });
        });

        it('should fail with UnauthorizedError when data are provided in unsupported target', function() {
            var fn = clientMiddleware({
                dataDestinations: ['headers'],
                depot: {
                    host: 'depot.bistudio.com',
                    ssl: false,
                    serviceName: 'bi-service'
                }
            });
            var self = this;

            this.req.query = {
                client_id: this.clientRecord.id,
            };

            this.requestGetStub.returns(Promise.reject(new SDKRequestError({
                code: 400,
                apiCode: API_CODES.CLIENT_NOT_FOUND
            })));
            this.context.route.uid = 'notRelevant';

            return fn.call(this.context, this.req, this.res)
                .should.be.rejectedWith(UnauthorizedError);
        });

        it('should fail with an Error', function() {
            var fn = clientMiddleware({
                dataDestinations: ['query'],
                depot: {
                    host: 'depot.bistudio.com',
                    ssl: false,
                    serviceName: 'bi-service'
                }
            });
            var self = this;

            this.req.query = {
                client_id: this.clientRecord.id,
            };

            var err = new Error('test');
            this.requestGetStub.returns(Promise.reject(err));
            this.context.route.uid = 'notRelevant';

            return fn.call(this.context, this.req, this.res)
                .should.be.rejectedWith(err);
        });

        it('should fail with UnauthorizedError', function() {
            var fn = clientMiddleware({clientSecret: true});
            var self = this;

            this.req.query = {
                client_id: this.clientRecord.id,
                client_secret: 'some-invalid-value'
            };

            this.requestGetStub.returns(Promise.resolve({data:this.clientRecord}));
            this.context.route.uid = 'notRelevant';

            return fn.call(this.context, this.req, this.res).should.be.rejectedWith(UnauthorizedError);
        });
    });

    describe('clientId option', function() {
        it("should return fulfilled promise and successfully validate client's secret value", function() {
            var clientIdGetterSpy = sinon.spy(function(req) {
                return req.query.clientId;
            });

            var fn = clientMiddleware({clientId: clientIdGetterSpy});
            var self = this;

            this.req.query = {
                clientId: this.clientRecord.id
            };
            this.req.method = 'get';

            this.requestGetStub.returns(Promise.resolve({data: this.clientRecord}));
            this.context.route.uid = 'notRelevant';

            return fn.call(this.context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.equal(self.clientRecord);
                clientIdGetterSpy.should.have.been.calledOnce;
                clientIdGetterSpy.should.have.been.calledWith(self.req, self.res);
            });
        });

        it('should fail with UnauthorizedError if we provide invalid client id value', function() {
            var fn = clientMiddleware();
            var self = this;

            this.req.query = {
                client_id: 'some-invalid-value'
            };

            this.requestGetStub.returns(Promise.reject(new SDKRequestError({
                code: 400,
                apiCode: API_CODES.CLIENT_NOT_FOUND
            })));

            this.context.route.uid = 'notrelevant';

            return fn.call(this.context, this.req, this.res).should.be.rejectedWith(UnauthorizedError);
        });
    });

    describe('restrictScope option', function() {
        it('should check scope permission of client being validated', function() {
            var fn = clientMiddleware({restrictScope: true});
            var self = this;

            this.req.query = {
                client_id: this.clientRecord.id
            };

            this.requestGetStub.returns(Promise.resolve({data:this.clientRecord}));
            this.context.route.uid = 'getUser_v1.0';

            return fn.call(this.context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.equal(self.clientRecord);
            });
        });

        it('should fail with UnauthorizedError', function() {
            var fn = clientMiddleware({restrictScope: true});
            var self = this;

            this.req.query = {
                client_id: this.clientRecord.id
            };

            this.requestGetStub.returns(Promise.resolve({data: this.clientRecord}));
            this.context.route.uid = 'forbiden-scope-id';

            return fn.call(this.context, this.req, this.res).should.be.rejectedWith(UnauthorizedError);
        });
    });
});
