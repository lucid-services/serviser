var fs             = require('fs');
var vm             = require('vm');
var path           = require('path');
var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var Promise        = require('bluebird');
var couchbase      = require('couchbase');
var CouchbaseODM   = require('kouchbase-odm');
var BucketMock     = require('couchbase/lib/mock/bucket');

var loaderPath = path.normalize(__dirname + '/../../../lib/staticData/loader.js');
var ConfigMock = require('../mocks/config.js');
var CouchbaseCluster = require('../../../lib/database/couchbase.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('static data loader', function() {
    before(function() {
        var self = this;
        var loaderSrc = fs.readFileSync(loaderPath);

        this.config = new ConfigMock();
        this.configGetStub = sinon.stub(this.config, 'get');

        this.loader = new vm.Script(loaderSrc, {
            filename: 'loader.js'
        });

        this.context = {
            Error: Error,
            Array: Array,
            Object: Object,
            Function: Function,
            require: sinon.stub(),
            process: {
                stdout: {
                    write: sinon.spy()
                },
                exit: sinon.spy()
            },
            console: {
                log: console.log,
                error: sinon.spy()
            }
        };

        this.postgresConfig = {
            db: 'test',
            user: 'test',
            host: 'localhost'
        };

        this.couchbaseConfig = {
            host: 'localhost',
            buckets: {
                main: {
                    bucket: 'test'
                }
            }
        };

        this.minimistStub = sinon.stub();
        this.moduleLoaderStub = {
            loadORMmodels: sinon.stub(),
            loadODMmodels: sinon.stub(),
            getCachedModels: sinon.stub()
        };
        this.sequelizeBuilderStub = sinon.stub();
        this.sequelizeStub = sinon.stub();
        this.clusterStub = sinon.stub(couchbase, 'Cluster', function(host) {
            return new couchbase.Mock.Cluster(host);
        });

        vm.createContext(this.context);

        this.runLoader = function() {
            self.loader.runInContext(self.context, {
                timeout: 3000
            });
        };
    });

    after(function() {
        this.clusterStub.restore();
    });

    beforeEach(function() {
        this.configGetStub.reset();
        this.minimistStub.reset();
        this.moduleLoaderStub.loadORMmodels.reset();
        this.moduleLoaderStub.loadODMmodels.reset();
        this.moduleLoaderStub.getCachedModels.reset();
        this.sequelizeBuilderStub.reset();
        this.sequelizeStub.reset();
        this.context.require.reset();
        this.context.process.stdout.write.reset();
        this.context.process.exit.reset();
        this.context.console.error.reset();

        this.context.require.withArgs('bluebird').returns(Promise);
        this.context.require.withArgs('bi-config').returns(this.config);
        this.context.require.withArgs('minimist').returns(this.minimistStub);
        this.context.require.withArgs('kouchbase-odm').returns(CouchbaseODM);
        this.context.require.withArgs('../moduleLoader.js').returns(this.moduleLoaderStub);
        this.context.require.withArgs('../database/sequelize.js').returns(this.sequelizeBuilderStub);
        this.context.require.withArgs('../database/couchbase.js').returns(CouchbaseCluster);

        this.sequelizeBuilderStub.returns(this.sequelizeStub);
        //this.configGetStub.returns();
        this.configGetStub.withArgs('sequelize').returns(this.postgresConfig);
        this.configGetStub.withArgs('couchbase').returns(this.couchbaseConfig);
    });

    it("should exit with status code (1) when we don't provide module destination", function() {
        this.moduleLoaderStub.getCachedModels.returns({
            odm: {},
            orm: {}
        });
        this.minimistStub.returns({});

        this.runLoader();

        this.context.process.exit.should.have.been.calledOnce;
        this.context.process.exit.should.have.been.calledWithExactly(1);
    });

    it("should return an Error when we don't provide module destination", function() {
        this.moduleLoaderStub.getCachedModels.returns({
            odm: {},
            orm: {}
        });
        this.minimistStub.returns({});

        this.runLoader();

        this.context.console.error.should.have.been.calledOnce;
        this.context.console.error.should.have.been.calledWith(sinon.match.instanceOf(Error));
    });

    it('should load orm && odm models from given destinations', function() {
        var destinations = [
            './path/to/some/dir/',
            '../path/to/some/file.js',
        ];

        this.minimistStub.returns({
            path: destinations
        });

        this.runLoader();

        this.moduleLoaderStub.loadORMmodels.should.have.been.calledOnce;
        this.moduleLoaderStub.loadORMmodels.should.have.been.calledWithExactly(
            destinations,
            this.sequelizeStub
        );
        this.moduleLoaderStub.loadODMmodels.should.have.been.calledOnce;
        this.moduleLoaderStub.loadODMmodels.should.have.been.calledWithExactly(
            destinations,
            sinon.match(function(cluster) {
                return cluster instanceof CouchbaseCluster;
            }),
            sinon.match(function(odm) {
                return odm instanceof CouchbaseODM;
            })
        );
    });

    it('should call the `initStaticData` method on each model if the model has the method', function() {
        var initStaticDataSpy = sinon.spy();

        var models = {
            orm: {
                Group: {},
                GroupType: {
                    initStaticData: initStaticDataSpy
                },
                Apps: {
                    initStaticData: initStaticDataSpy
                }
            },
            odm: {
                User: {
                    initStaticData: initStaticDataSpy
                }
            }
        };
        this.moduleLoaderStub.getCachedModels.returns(models);

        this.runLoader();

        initStaticDataSpy.should.have.been.calledThrice;
    });

    it('should await all pending Promise operations and write stringified json result data to the stdout ', function(done) {
        this.slow(510);

        var self = this;
        var data = {
            some: 'data'
        };

        var initStaticDataSpy = sinon.spy(function() {
            return Promise.resolve(data);
        });

        var models = {
            orm: {
                Role: {
                    initStaticData: initStaticDataSpy
                },
                GroupType: {
                    initStaticData: initStaticDataSpy
                },
                Apps: {
                    initStaticData: initStaticDataSpy
                }
            },
            odm: {
                User: {
                    initStaticData: initStaticDataSpy
                }
            }
        };

        this.minimistStub.returns({path: ['/some/path/to/dir/']});
        this.moduleLoaderStub.getCachedModels.returns(models);

        this.runLoader();

        //TODO better solution than using timeout
        setTimeout(function() {
            initStaticDataSpy.should.always.have.been.calledBefore(self.context.process.stdout.write);
            self.context.process.stdout.write.should.have.been.calledOnce;
            self.context.process.stdout.write.should.have.been.calledWith(
                `${JSON.stringify({
                    orm: {
                        Role: data,
                        GroupType: data,
                        Apps: data
                    },
                    odm: {
                        User: data
                    }
                })}\n`
            );

            self.context.process.exit.should.have.been.calledOnce;
            self.context.process.exit.should.have.been.calledWith(0);
            done();
        }, 500);
    });

    it('should return an Error and exit with status code (1) when the error occurs during data loading', function(done) {
        this.slow(510);

        var self = this;
        var error = new Error('Failing promise operation - test');

        var initStaticDataSpy = sinon.spy(function() {
            return Promise.reject(error);
        });

        var models = {
            orm: {
                Role: {
                    initStaticData: initStaticDataSpy
                },
                GroupType: {
                    initStaticData: initStaticDataSpy
                }
            },
            odm: {
                User: {
                    initStaticData: initStaticDataSpy
                }
            }
        };

        this.minimistStub.returns({path: ['/some/path/to/dir/']});
        this.moduleLoaderStub.getCachedModels.returns(models);

        this.runLoader();

        //TODO better solution than using timeout
        setTimeout(function() {
            self.context.console.error.should.have.been.calledOnce;
            self.context.console.error.should.have.been.calledWith(error);

            self.context.process.exit.should.have.been.calledOnce;
            self.context.process.exit.should.have.been.calledWith(1);
            done();
        }, 500);
    });
});
