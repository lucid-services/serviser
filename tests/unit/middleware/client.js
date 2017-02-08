var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var couchbase      = require('couchbase');
var CouchbaseODM   = require('kouchbase-odm');
var Promise        = require('bluebird');
var BucketMock     = require('couchbase/lib/mock/bucket');

var UnauthorizedError       = require('../../../lib/error/unauthorizedError.js');
var ServiceError            = require('../../../lib/error/serviceError.js');
var CouchbaseCluster        = require('../../../lib/database/couchbase.js');
var AppManager              = require('../../../lib/express/appManager.js');
var Config                  = require('../mocks/config.js');
var clientMiddlewareBuilder = require('../../../lib/middleware/client.js');
var clientModelBuilder      = require('../../../lib/models/odm/client.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('client middleware', function() {

    before(function() {
        var self = this;
        this.models = {};
        this.config = new Config();

        this.clusterStub = sinon.stub(couchbase, 'Cluster', function(host) {
            return new couchbase.Mock.Cluster(host);
        });

        this.appManager = new AppManager(this.models);
        var app = this.app = this.appManager.buildApp(this.config);

        this.res = {};
        this.req = {};
        this.next = sinon.spy();
        this.couchbaseCluster = new CouchbaseCluster({
            host: 'inmemory',
            buckets: {
                main: {
                    bucket: 'clientMiddlewareBucke'
                }
            }
        });

        this.odm = new CouchbaseODM({
            bucket: this.couchbaseCluster.openBucketSync('main')
        });

        this.ClientModel = clientModelBuilder(this.couchbaseCluster, this.odm);
        this.clientMiddleware = clientMiddlewareBuilder(this.ClientModel);

        return this.ClientModel.create({
            name: 'test1',
            clientSecret: '$c80848cdc6c22b77d4a8ae9de520610',
            scopes: [
                'getUser_v1.0',
                'postUser_v1.0'
            ],
            redirectUrls: [
                "^https://bistudio.com",
                "ylands.com$"
            ]
        }, {
            key: '$aa81b716da75b5ba7129ad1c92f2698'
        }).then(function(client) {
            self.client = client;
        });
    });

    after(function() {
        this.clusterStub.restore();
    });

    beforeEach(function() {
        this.req = {};
        this.next.reset();
    });

    it('should fail with a ServiceError when the restrictScope option is enabled and the route does not have uid set', function() {
        var fn = this.clientMiddleware({restrictScope: true});
        var self = this;

        this.req.query = {
            client_id: this.client.getKey().getId()
        };

        var context = {route: {uid: undefined}};

        return fn.call(context, this.req, this.res).should.be.rejectedWith(ServiceError);
    });

    describe('clientSecret option', function() {
        it("should return fulfilled promise and successfully validate client's secret value", function() {
            var fn = this.clientMiddleware({clientSecret: true});
            var self = this;

            this.req.query = {
                client_id: this.client.getKey().getId(),
                client_secret: this.client.clientSecret
            };

            var context = {route: {uid: 'notRelevant'}};

            return fn.call(context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.instanceof(CouchbaseODM.Instance);
            });
        });

        it("should return fulfilled promise and successfully validate client's secret value (2)", function() {
            var clientSecretGetterSpy = sinon.spy(function(req) {
                return req.query.clientSecret;
            });

            var fn = this.clientMiddleware({clientSecret: clientSecretGetterSpy});
            var self = this;

            this.req.query = {
                client_id: this.client.getKey().getId(),
                clientSecret: this.client.clientSecret
            };

            var context = {route: {uid: 'notRelevant'}};

            return fn.call(context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.instanceof(CouchbaseODM.Instance);
                clientSecretGetterSpy.should.have.been.calledOnce;
                clientSecretGetterSpy.should.have.been.calledWith(self.req, self.res);
            });
        });

        it('should NOT fail when we pass invalid client secret value and the clientSecret option is disabled', function() {
            var fn = this.clientMiddleware({clientSecret: false});
            var self = this;

            this.req.query = {
                client_id: this.client.getKey().getId(),
                client_secret: 'some-invalid-value'
            };

            var context = {route: {uid: 'notRelevant'}};

            return fn.call(context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.instanceof(CouchbaseODM.Instance);
            });
        });

        it('should fail with UnauthorizedError', function() {
            var fn = this.clientMiddleware({clientSecret: true});
            var self = this;

            this.req.query = {
                client_id: this.client.getKey().getId(),
                client_secret: 'some-invalid-value'
            };

            var context = {route: {uid: 'notRelevant'}};

            return fn.call(context, this.req, this.res).should.be.rejectedWith(UnauthorizedError);
        });
    });

    describe('clientId option', function() {
        it("should return fulfilled promise and successfully validate client's secret value", function() {
            var clientIdGetterSpy = sinon.spy(function(req) {
                return req.query.clientId;
            });

            var fn = this.clientMiddleware({clientId: clientIdGetterSpy});
            var self = this;

            this.req.query = {
                clientId: this.client.getKey().getId()
            };
            this.req.method = 'get';

            var context = {route: {uid: 'notRelevant'}};

            return fn.call(context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.instanceof(CouchbaseODM.Instance);
                clientIdGetterSpy.should.have.been.calledOnce;
                clientIdGetterSpy.should.have.been.calledWith(self.req, self.res);
            });
        });

        it('should fail with UnauthorizedError if we provide invalid client id value', function() {
            var fn = this.clientMiddleware();
            var self = this;

            this.req.query = {
                client_id: 'some-invalid-value'
            };

            var context = {route: {uid: 'notRelevant'}};

            return fn.call(context, this.req, this.res).should.be.rejectedWith(UnauthorizedError);
        });
    });

    describe('restrictScope option', function() {
        it('should check scope permission of client being validated', function() {
            var fn = this.clientMiddleware({restrictScope: true});
            var self = this;

            this.req.query = {
                client_id: this.client.getKey().getId()
            };

            var context = {route: {uid: 'getUser_v1.0'}};

            return fn.call(context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.instanceof(CouchbaseODM.Instance);
            });
        });

        it('should fail with UnauthorizedError', function() {
            var fn = this.clientMiddleware({restrictScope: true});
            var self = this;

            this.req.query = {
                client_id: this.client.getKey().getId()
            };

            var context = {route: {uid: 'forbiden-scope-id'}};

            return fn.call(context, this.req, this.res).should.be.rejectedWith(UnauthorizedError);
        });
    });

    describe('restrictRedirect option', function() {
        it('should return fulfilled promise with client', function() {
            var fn = this.clientMiddleware({restrictRedirect: true});
            var self = this;

            this.req.query = {
                client_id: this.client.getKey().getId(),
                redirect_url: 'https://bistudio.com/some/url',
                redirect_back: 'http://subdomain.ylands.com',
            };

            var context = {route: {uid: 'notRelevant'}};

            return fn.call(context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.instanceof(CouchbaseODM.Instance);
            });
        });

        it('should NOT fail when the restrictRedirect option is redirect and redirect urls dont match any pattern', function() {
            var fn = this.clientMiddleware({restrictRedirect: false});
            var self = this;

            this.req.query = {
                client_id: this.client.getKey().getId(),
                redirect_url: 'some-crazy-shit',
                redirect_back: 'https://invalidurl.com',
            };

            var context = {route: {uid: 'notRelevant'}};

            return fn.call(context, this.req, this.res).should.be.fulfilled.then(function() {
                self.req.client.should.be.instanceof(CouchbaseODM.Instance);
            });
        });

        it('should fail with UnauthorizedError when redirect_url doesnt match allowed pattern', function() {
            var fn = this.clientMiddleware({restrictRedirect: true});
            var self = this;

            this.req.query = {
                client_id: this.client.getKey().getId(),
                redirect_url: 'some-crazy-shit'
            };

            var context = {route: {uid: 'notRelevant'}};

            return fn.call(context, this.req, this.res).should.be.rejectedWith(UnauthorizedError);
        });

        [[], {}, 'invalid-url', 'forbided-url'].forEach(function(invalidUrlRedirectValue, index) {

            it(`Index: ${index} should fail with UnauthorizedError when redirect_back doesnt match allowed pattern`, function() {
                var fn = this.clientMiddleware({restrictRedirect: true});
                var self = this;

                this.req.query = {
                    client_id: this.client.getKey().getId(),
                    redirect_back: invalidUrlRedirectValue
                };

                var context = {route: {uid: 'notRelevant'}};

                return fn.call(context, this.req, this.res).should.be.rejectedWith(UnauthorizedError);
            });
        })
    });
});
