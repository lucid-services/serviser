var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var Promise        = require('bluebird');
var couchbase      = require('couchbase');
var BucketMock     = require('couchbase/lib/mock/bucket');
var events         = require('events');

var CouchbaseCluster = require('../../../lib/database/couchbase.js');
var ServiceError = require('../../../lib/error/serviceError.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('CouchbaseCluster', function() {

    before(function() {
        this.clusterStub = sinon.stub(couchbase, 'Cluster', function(host) {
            return new couchbase.Mock.Cluster(host);
        });
    });

    after(function() {
        this.clusterStub.restore();
    });

    afterEach(function() {
        this.clusterStub.reset();
    });

    describe('constructor', function() {
        it('should create new couchbase Cluster with received connection options', function() {
            var options = {
                host: 'localhost'
            };

            var couchbaseCluster = new CouchbaseCluster(options);

            this.clusterStub.should.have.been.calledOnce;
            this.clusterStub.should.have.been.calledWithNew;
            this.clusterStub.should.have.been.calledWith(options.host);
        });

        it('should clone received options', function() {
            var options = {
                host: 'localhost'
            };

            var couchbaseCluster = new CouchbaseCluster(options);

            couchbaseCluster.options.should.be.eql(options);
            couchbaseCluster.options.should.not.be.equal(options);
        });
    });

    describe('get', function() {
        before(function() {
            this.options = {
                host: 'localhost',
                buckets: {
                    main: {
                        bucket: 'default'
                    }
                }
            };

            this.couchbaseCluster = new CouchbaseCluster(this.options);
        });

        it('should throw a ServiceError when there is no such bucket connection', function() {
            var self = this;

            function test() {
                self.couchbaseCluster.get('non-existing-bucket-name');
            }

            expect(test).to.throw(ServiceError);
        });

        it('should return connection to the main bucket', function() {
            var bucket = this.couchbaseCluster.openBucketSync('main');

            this.couchbaseCluster.get('main').should.be.equal(bucket);
        });
    });

    describe('openBucketSync', function() {
        before(function() {
            this.options = {
                host: 'localhost',
                buckets: {
                    main: {
                        bucket: 'default'
                    },
                    cache: {
                        bucket: 'cache'
                    }
                }
            };

            this.couchbaseCluster = new CouchbaseCluster(this.options);
        });

        it('should create a new connection and return the Bucket object', function() {
            var bucket = this.couchbaseCluster.openBucketSync('cache');
            bucket.should.be.an.instanceof(BucketMock);
        });

        it('should return already created connection if there is any', function() {
            var bucket = this.couchbaseCluster.openBucketSync('main');
            this.couchbaseCluster.openBucketSync('main').should.be.equal(bucket);
        });

        it('should throw a ServiceError if we try to establish new connection to a bucket which has not been listed in config ', function() {
            var self = this;

            function test() {
                self.couchbaseCluster.openBucketSync('rubish');
            }

            expect(test).to.throw(ServiceError);
        });
    });

    describe('openBucket', function() {
        before(function() {
            this.options = {
                host: 'localhost',
                buckets: {
                    main: {
                        bucket: 'default'
                    },
                    cache: {
                        bucket: 'cache'
                    }
                }
            };

            this.couchbaseCluster = new CouchbaseCluster(this.options);
        });

        it('should create a new connection and return the Bucket object', function() {
            return this.couchbaseCluster.openBucket('cache').should.be.fulfilled.then(function(bucket) {
                bucket.should.be.an.instanceof(BucketMock);
            });
        });

        it('should return already created connection if there is any', function() {
            var self = this;

            return this.couchbaseCluster.openBucket('main').bind({}).then(function(bucket) {
                this.bucket = bucket;
                return self.couchbaseCluster.openBucket('main');
            }).should.be.fulfilled.then(function(bucket) {
                bucket.should.be.equal(this.bucket);
            });
        });

        it('should throw a ServiceError if we try to establish new connection to a bucket which has not been listed in config ', function() {
            var self = this;

            return self.couchbaseCluster.openBucket('rubish').should.be.rejectedWith(ServiceError);

        });
    });

    describe('build', function() {
        it('should return new CouchbaseCluster object with correct initialization options', function() {
            var options = {
                host: 'localhost'
            };

            var cluster = CouchbaseCluster.build(options);

            cluster.should.be.an.instanceof(CouchbaseCluster);
            cluster.options.should.be.eql(options);
        });
    });
});
