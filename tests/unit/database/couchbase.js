var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var Promise        = require('bluebird');
var couchbase      = require('couchbase');
var BucketMock     = require('couchbase/lib/mock/bucket');
var events         = require('events');

var CouchbaseCluster = require('../../../lib/database/couchbase.js');

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
                host: 'localhost',
                buckets: {
                    main: {bucket: 'main'}
                }
            };

            var couchbaseCluster = new CouchbaseCluster(options);

            this.clusterStub.should.have.been.calledOnce;
            this.clusterStub.should.have.been.calledWithNew;
            this.clusterStub.should.have.been.calledWith(options.host);
        });

        it('should clone received options', function() {
            var options = {
                host: 'localhost',
                buckets: {
                    main: {bucket: 'main'}
                }
            };

            var couchbaseCluster = new CouchbaseCluster(options);

            couchbaseCluster.options.should.be.eql(options);
            couchbaseCluster.options.should.not.be.equal(options);
        });

        it('should throw an Error when we try to create empty cluster (a cluster without any buckets)', function() {
            function test() {
                return new CouchbaseCluster({
                    host: 'localhost',
                });
            }

            expect(test).to.throw(Error);
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

        it('should throw an Error when there is no such bucket connection', function() {
            var self = this;

            function test() {
                self.couchbaseCluster.get('non-existing-bucket-name');
            }

            expect(test).to.throw(Error);
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
                    },
                    storage: {
                        bucket: 'storage'
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

        it('should throw an Error if we try to establish new connection to a bucket which has not been listed in config ', function() {
            var self = this;

            function test() {
                self.couchbaseCluster.openBucketSync('rubish');
            }

            expect(test).to.throw(Error);
        });

        it("should register `error` event listener on created bucket which redirect the event to ours custom CouchbaseCluster object", function() {
            var spy = sinon.spy();
            var err = new Error;

            var bucket = this.couchbaseCluster.openBucketSync('main');
            this.couchbaseCluster.on('error', spy);

            bucket.emit('error', err);

            spy.should.have.been.calledOnce;
            spy.should.have.been.calledWithExactly(err);
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

        it('should return promisified bucket', function() {

            return this.couchbaseCluster.openBucket('main').then(function(bucket) {
                bucket.should.have.property('getAsync').that.is.a('function');
                bucket.should.have.property('insertAsync').that.is.a('function');
                bucket.should.have.property('appendAsync').that.is.a('function');
                bucket.should.have.property('getMultiAsync').that.is.a('function');
            });
        });

        it('should throw an Error if we try to establish new connection to a bucket which has not been listed in config ', function() {
            return this.couchbaseCluster.openBucket('rubish').should.be.rejectedWith(Error);
        });
    });

    describe('build', function() {
        it('should return new CouchbaseCluster object with correct initialization options', function() {
            var options = {
                host: 'localhost',
                buckets: {
                    main: {bucket: 'main'}
                }
            };

            var cluster = CouchbaseCluster.build(options);

            cluster.should.be.an.instanceof(CouchbaseCluster);
            cluster.options.should.be.eql(options);
        });
    });
});
