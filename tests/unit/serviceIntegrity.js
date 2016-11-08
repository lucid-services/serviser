var Promise        = require('bluebird');
var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var couchbase      = require('couchbase');
var BucketMock     = require('couchbase/lib/mock/bucket');

var ServiceError     = require('../../lib/error/serviceError.js');
var serviceIntegrity = require('../../lib/serviceIntegrity.js');
var CouchbaseCluster = require('../../lib/database/couchbase.js');
var sequelizeBuilder = require('../../lib/database/sequelize.js');
var AppManager       = require('../../lib/express/appManager.js');
var App              = require('../../lib/express/app.js');
var AppStatus        = require('../../lib/express/appStatus.js');
var Config           = require('./mocks/config.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe.only('serviceIntegrity', function() {
    before(function() {
        this.models = {};
        this.config = new Config();

        this.configGetStub = sinon.stub(this.config, 'get');

        this.appManager = new AppManager(this.config, this.models);
        var app = this.app = this.appManager.buildApp();
    });

    beforeEach(function() {
        this.configGetStub.reset();
    });

    describe('inspect', function() {
        before(function() {
            this.inspectNodeStub = sinon.stub(serviceIntegrity, 'inspectNode');
            this.inspectPostgresStub = sinon.stub(serviceIntegrity, 'inspectPostgres');
            this.inspectCouchbaseStub = sinon.stub(serviceIntegrity, 'inspectCouchbase');
        });

        beforeEach(function() {
            this.inspectNodeStub.reset();
            this.inspectPostgresStub.reset();
            this.inspectCouchbaseStub.reset();
        });

        after(function() {
            this.inspectNodeStub.restore();
            this.inspectPostgresStub.restore();
            this.inspectCouchbaseStub.restore();
        });

        describe('all checks are resolved', function() {
            beforeEach(function() {
                this.inspectNodeStub.returns(true);
                this.inspectPostgresStub.returns(Promise.resolve(true));
                this.inspectCouchbaseStub.returns(Promise.resolve(true));
            });

            it('should return resolved promise', function() {

                return serviceIntegrity.inspect(this.app).should.become({
                    node: true,
                    postgres: true,
                    couchbase: true
                });
            });

            it('should call inspectNode method', function() {

                return serviceIntegrity.inspect(this.app).bind(this).then(function() {
                    this.inspectNodeStub.should.have.been.calledOnce;
                });

            });

            it('should call inspectPostgres method', function() {

                return serviceIntegrity.inspect(this.app).bind(this).then(function() {
                    this.inspectPostgresStub.should.have.been.calledOnce;
                    this.inspectPostgresStub.should.have.been.calledWithExactly(this.app);
                });

            });

            it('should call inspectCouchbase method', function() {

                return serviceIntegrity.inspect(this.app).bind(this).then(function() {
                    this.inspectCouchbaseStub.should.have.been.calledOnce;
                    this.inspectCouchbaseStub.should.have.been.calledWithExactly(this.app);
                });

            });
        });

        it('should return rejected promise with rejection reason', function() {
            var nodeError = new Error('Inspect node test');
            var postgresError = new Error('Inspect postgres test');

            this.inspectNodeStub.throws(nodeError);
            this.inspectPostgresStub.returns(Promise.reject(postgresError));
            this.inspectCouchbaseStub.returns(Promise.resolve(true));

            return serviceIntegrity.inspect(this.app).should.be.rejected
                .then(function(err) {
                    err.should.be.instanceof(ServiceError);
                    err.should.have.property('context').that.is.eql({
                        node: nodeError,
                        postgres: postgresError,
                        couchbase: true
                    });
                });
        });
    });

    describe('inspectPostgres', function() {
        describe('postgres driver NOT set', function() {
            it('should return resolved Promise with false', function() {
                return serviceIntegrity.inspectPostgres(this.app).should.be.fulfilled.then(function(result) {
                    result.should.be.equal(false);
                });
            });
        });

        describe('postgres driver IS set', function() {
            before(function() {

                this.sequelize = sequelizeBuilder({
                    dialect  : 'postgres',
                    host     : 'localhost',
                    username : 'root',
                    db       : 'test'
                });

                this.queryStub = sinon.stub(this.sequelize, 'query');
                this.app.useSequelize(this.sequelize);
            });

            beforeEach(function() {
                this.queryStub.reset();
            });

            it('should make a select query requesting postgres version', function() {
                var self = this;
                this.queryStub.returns(Promise.resolve([
                    {server_version: '1.0.0'}
                ]));

                return serviceIntegrity.inspectPostgres(this.app).then(function() {
                    self.queryStub.should.have.been.calledOnce;
                    self.queryStub.should.have.been.calledWith(
                        'SHOW server_version;',
                        {
                            type: self.app.sequelize.QueryTypes.SELECT
                        }
                    );
                });
            });

            it('should return rejected Promise', function() {
                var error = new Error;
                this.queryStub.returns(Promise.reject(error));

                return serviceIntegrity.inspectPostgres(this.app).should.be.rejectedWith(error);
            });

            it('should return rejected promise when the actual postgres version does not satisfy required version', function() {
                var version = '1.0.0';
                var expected = '1.5.0';

                this.queryStub.returns(Promise.resolve([
                    {server_version: version}
                ]));

                this.configGetStub.returns(expected);

                return serviceIntegrity.inspectPostgres(this.app).should.be.rejected;
            });

            it('should return fulfilled promise with true', function() {
                this.queryStub.returns(Promise.resolve([
                    {server_version: '1.1.0'}
                ]));

                this.configGetStub.returns('1.0.0');

                return serviceIntegrity.inspectPostgres(this.app).should.be.fulfilled.then(function(result) {
                    result.should.be.equal(true);
                });
            });
        });
    });

    describe('inspectCouchbase', function() {
        describe('couchbase driver is NOT set', function() {
            it('should return resolved Promise with false', function() {
                return serviceIntegrity.inspectCouchbase(this.app).should.be.fulfilled.then(function(result) {
                    result.should.be.equal(false);
                });
            });
        });

        describe('couchbase driver IS set', function() {
            before(function() {

                var self = this;

                this.clusterStub = sinon.stub(couchbase, 'Cluster', function(host) {
                    return new couchbase.Mock.Cluster(host);
                });

                this.buckets = {
                    main: {
                        bucket: 'default'
                    },
                    cache: {
                        bucket: 'cache'
                    }
                };

                this.couchbaseCluster = new CouchbaseCluster({
                    host: 'localhost',
                    buckets: this.buckets
                });

                this.app.useCouchbase(this.couchbaseCluster);

                //open 2 buckets
                this.couchbaseCluster.openBucketSync('main');
                this.couchbaseCluster.openBucketSync('cache');

                this.couchbaseGetStub = sinon.stub(BucketMock.prototype, 'get');
            });

            beforeEach(function() {
                this.couchbaseGetStub.reset();
            });

            after(function() {
                this.clusterStub.restore();
                this.couchbaseGetStub.restore();
            });

            it('should make a select query for each of the two opened buckets', function() {
                var self = this;

                this.couchbaseGetStub.yields(null, {
                    cas: '123456',
                    value: {}
                });

                return serviceIntegrity.inspectCouchbase(this.app).then(function(result) {
                    self.couchbaseGetStub.should.have.been.calledTwice;
                });
            });

            it('should return resolved promise when we get the `keyNotFound` error', function() {
                var self = this;
                var error = new Error;
                error.code = couchbase.errors.keyNotFound;

                this.couchbaseGetStub.yields(error);


                return serviceIntegrity.inspectCouchbase(this.app).should.be.fulfilled;
            });

            it('should return resolved promise when a document we search for is found', function() {
                var self = this;
                var key = serviceIntegrity.$couchbaseDocumentKey;
                var data = {};

                this.couchbaseGetStub.yields(null, {
                    cas: '123456',
                    value: {}
                });

                return serviceIntegrity.inspectCouchbase(self.app).should.be.fulfilled;
            });

            it('should return rejected promise when there occurs any other error than the `keyNotFound` error', function() {
                var self = this;
                var error = new Error;
                error.code = couchbase.errors.connectError;

                this.couchbaseGetStub.yields(error);

                return serviceIntegrity.inspectCouchbase(this.app).should.be.rejectedWith(sinon.match(function(err) {
                    return err instanceof Error && err.code === couchbase.errors.connectError;
                }));
            });

            it('should return resolved promise with `true` if all checks pass', function() {
                this.couchbaseGetStub.yields(null, {
                    cas: '123456',
                    value: {}
                });

                return serviceIntegrity.inspectCouchbase(this.app).should.be.fulfilled.then(function(result) {
                    result.should.be.equal(true);
                });
            });
        });
    });

    describe('inspectNode', function() {
        it("should return false when there is no expected version set in the app's config", function() {
            this.configGetStub.returns(undefined);

            serviceIntegrity.inspectNode(this.app).should.be.equal(false);
        });

        it('should return true when the node version is successfully validated', function() {
            this.configGetStub.returns('0.10.1');

            serviceIntegrity.inspectNode(this.app).should.be.equal(true);
        });

        it('should throw an Error when there is node version mismatch', function() {
            var self = this;
            this.configGetStub.returns('120.1.1');

            function test() {
                serviceIntegrity.inspectNode(self.app);
            }

            expect(test).to.throw(Error);
        });
    });

});
