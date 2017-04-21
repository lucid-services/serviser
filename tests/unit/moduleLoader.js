var rewire       = require('rewire');
var sinon        = require('sinon');
var chai         = require('chai');
var sinonChai    = require("sinon-chai");
var tmp          = require('tmp');
var CouchbaseODM = require('kouchbase-odm');

var moduleLoader = rewire('../../lib/moduleLoader.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('moduleLoader', function() {

    before(function() {
        var self = this;
        this.moduleStub = sinon.stub();
        this.requireSpy = sinon.spy(function(path) {

            var module = require(path);
            //if we require something else than module difinitions inside /tmp ,
            //we want the module as the output
            if (path.indexOf('/tmp') !== 0) {
                return module;
            }
            return self.moduleStub;
        });
        this.requireSpy.extensions = require.extensions;

        moduleLoader.__set__('require', this.requireSpy);

        tmp.setGracefulCleanup();
        var tmpDir = this.tmpDir = tmp.dirSync({unsafeCleanup: true});

    });

    beforeEach(function() {
        this.requireSpy.reset();
    });

    after(function() {
        this.tmpDir.removeCallback();
    });

    describe('loadORMmodels', function() {
        before(function() {
            this.sequelizeMock = {
                import: sinon.stub()
            };

            var tree = {
                orm: {
                    group: {
                        'group.js': null,
                        'groupPost.js': null,
                        'post.js': null,
                        user: {
                            'groupUser.js': null,
                            'groupUserApplication.js': null
                        }
                    }
                }
            };

            this.createFileTree(tree, this.tmpDir.name);

            this.models = {
                group                : createModelMock('group'),
                groupPost            : createModelMock('groupPost'),
                post                 : createModelMock('post'),
                groupUser            : createModelMock('groupUser'),
                groupUserApplication : createModelMock('groupUserApplication')
            };

            /*
             * createModelMock
             *
             * @param {String} name
             */
            function createModelMock(name) {
                return {
                    name: name,
                    associate: sinon.spy()
                };
            }
        });

        beforeEach(function() {
            var self = this;

            moduleLoader.__set__('models', {
                orm: {}
            });

            this.sequelizeMock.import.reset();

            //NOTE that it's not insured that the models are going to be loaded
            //in this specific order. It's probable that loaded files will
            //get interchanged with incorrect model mock.
            //It's acceptable here because it's not what we're testing
            this.sequelizeMock.import.onCall(0).returns(this.models.group);
            this.sequelizeMock.import.onCall(1).returns(this.models.post);
            this.sequelizeMock.import.onCall(2).returns(this.models.groupPost);
            this.sequelizeMock.import.onCall(3).returns(this.models.groupUser);
            this.sequelizeMock.import.onCall(4).returns(this.models.groupUserApplication);

            Object.keys(this.models).forEach(function(name) {
                var model = self.models[name];

                model.associate.reset();
            });
        });

        it('should call sequelize.import for each file ', function() {

            moduleLoader.loadORMmodels(
                this.tmpDir.name + '/orm/',
                this.sequelizeMock
            );

            this.sequelizeMock.import.should.have.callCount(5);
            this.sequelizeMock.import.should.always.have.been.calledWithExactly(sinon.match.string);
        });

        it('should skip excluded directories/files', function() {
            this.sequelizeMock.import.reset();

            this.sequelizeMock.import.onCall(0).returns(this.models.group);
            this.sequelizeMock.import.onCall(1).returns(this.models.groupPost);

            var models = moduleLoader.loadORMmodels(
                this.tmpDir.name + '/orm/',
                this.sequelizeMock,
                {
                    except: [
                        this.tmpDir.name + '/orm/group/post.js',
                        this.tmpDir.name + '/orm/group/user',
                    ]
                }
            );

            this.sequelizeMock.import.should.have.callCount(2);
            models.should.be.eql({
                Group: this.models.group,
                GroupPost: this.models.groupPost
            });
        });

        it('should call the `associate` method on each loaded model object', function() {
            var self = this;

            moduleLoader.loadORMmodels(
                this.tmpDir.name + '/orm/',
                this.sequelizeMock
            );

            var internalStorage = moduleLoader.__get__('models').orm;

            Object.keys(this.models).forEach(function(name) {
                var model = self.models[name];

                model.associate.should.have.been.calledOnce;
                model.associate.should.have.been.calledWith(internalStorage);
            });
        });

        it('should return dictionary of loaded models', function() {
            var models = moduleLoader.loadORMmodels(
                this.tmpDir.name + '/orm/',
                this.sequelizeMock
            );

            models.should.have.property('Group', this.models.group);
            models.should.have.property('GroupPost', this.models.groupPost);
            models.should.have.property('Post', this.models.post);
            models.should.have.property('GroupUser', this.models.groupUser);
            models.should.have.property('GroupUserApplication', this.models.groupUserApplication);
        });

        it("should append loaded models to the module's internal hash storage cache", function() {
            moduleLoader.loadORMmodels(
                this.tmpDir.name + '/orm/',
                this.sequelizeMock
            );

            var internalStorage = moduleLoader.__get__('models').orm;

            internalStorage.should.have.property('Group', this.models.group);
            internalStorage.should.have.property('GroupPost', this.models.groupPost);
            internalStorage.should.have.property('Post', this.models.post);
            internalStorage.should.have.property('GroupUser', this.models.groupUser);
            internalStorage.should.have.property('GroupUserApplication', this.models.groupUserApplication);
        });
    });

    describe('loadODMmodels', function() {
        before(function() {
            this.couchbaseClusterSpy = sinon.spy();
            this.couchbaseODMSpy = sinon.spy();

            var tree = {
                odm: {
                    user: {
                        'user.js': null,
                    },
                    token: {
                        'refreshToken.js': null,
                        'accessToken.js': null
                    }
                }
            };

            this.createFileTree(tree, this.tmpDir.name);

            this.models = {
                accessToken  : createModelMock('access_token'),
                refreshToken : createModelMock('refresh_token'),
                user         : createModelMock('user')
            };

            /*
             * createModelMock
             *
             * @param {String} name
             */
            function createModelMock(name) {
                function Model(name) {
                    this.name = name
                }
                Model.prototype = Object.create(CouchbaseODM.Model.prototype);

                return new Model(name);
            }
        });

        beforeEach(function() {
            moduleLoader.__set__('models', {
                odm: {}
            });

            this.moduleStub.reset();

            //NOTE that it's not insured that the models are going to be loaded
            //in this specific order. It's probable that loaded files will
            //get interchanged with incorrect model mock.
            //It's acceptable here as it's not what we're testing
            this.moduleStub.onCall(0).returns(this.models.accessToken);
            this.moduleStub.onCall(1).returns(this.models.refreshToken);
            this.moduleStub.onCall(2).returns(this.models.user);
        });

        it('should call exported builder function for each loaded file (module) ', function() {

            moduleLoader.loadODMmodels(
                this.tmpDir.name + '/odm/',
                [
                    this.couchbaseClusterSpy,
                    this.couchbaseODMSpy
                ]
            );

            this.moduleStub.should.have.callCount(3);
            this.moduleStub.should.always.have.been.calledWithExactly(
                this.couchbaseClusterSpy,
                this.couchbaseODMSpy
            );
        });

        it('should skip excluded directories/files', function() {
            moduleLoader.loadODMmodels(
                this.tmpDir.name + '/odm/',
                [
                    this.couchbaseClusterSpy,
                    this.couchbaseODMSpy
                ],
                {
                    except: [
                        this.tmpDir.name + '/odm/token/',
                        this.tmpDir.name + '/odm/user/',
                    ]
                }
            );

            this.requireSpy.should.have.callCount(1); //require('kouchbase-odm') call
            this.moduleStub.should.have.callCount(0);
        });

        it('should return dictionary of loaded models', function() {
            var models = moduleLoader.loadODMmodels(
                this.tmpDir.name + '/odm/',
                [
                    this.couchbaseClusterSpy,
                    this.couchbaseODMSpy
                ]
            );

            models.should.have.property('AccessToken', this.models.accessToken);
            models.should.have.property('RefreshToken', this.models.refreshToken);
            models.should.have.property('User', this.models.user);
        });

        it("should append loaded models to the module's internal hash storage cache", function() {
            moduleLoader.loadODMmodels(
                this.tmpDir.name + '/odm/',
                [
                    this.couchbaseClusterSpy,
                    this.couchbaseODMSpy
                ]
            );

            var internalStorage = moduleLoader.__get__('models').odm;

            internalStorage.should.have.property('AccessToken', this.models.accessToken);
            internalStorage.should.have.property('RefreshToken', this.models.refreshToken);
            internalStorage.should.have.property('User', this.models.user);
        });

        it('should skip modules which does not return an object of instance of CouchbaseODM.Model', function() {
            this.moduleStub.reset();

            this.moduleStub.onCall(0).returns({});
            this.moduleStub.onCall(1).returns({});
            this.moduleStub.onCall(2).returns({});

            var models = moduleLoader.loadODMmodels(
                this.tmpDir.name + '/odm/',
                [
                    this.couchbaseClusterSpy,
                    this.couchbaseODMSpy
                ]
            );

            var internalStorage = moduleLoader.__get__('models').odm;

            //no models should be loaded
            models.should.be.eql({});
            internalStorage.should.be.eql({});
        });
    });

    describe('loadModules', function() {
        before(function() {
            var tree = {
                modules: {
                    routes: {
                        'v1.0': {
                            'route1.js': null,
                            'route2.js': null,
                            'route3.js': null,
                            '.gitignore': null,
                            s2s: {
                                'route1.js': null,
                                'route2.js': null,
                                'route3.js': null,
                            }
                        },
                        'v2.0': {
                            'route4.js': null,
                            'route5.js': null,
                            'route6.js': null,
                        }
                    },
                }
            };

            this.createFileTree(tree, this.tmpDir.name);
        });

        it('should "require" every SUPPORTED file in provided directory', function() {
            moduleLoader.loadModules(
                this.tmpDir.name + '/modules/'
            );

            this.requireSpy.should.have.callCount(9);
            this.requireSpy.should.always.have.been.calledWithExactly(sinon.match.string);
        });

        it('should call defined callback for every required module', function() {
            var cbSpy = sinon.spy();
            moduleLoader.loadModules(
                this.tmpDir.name + '/modules/',
                { cb: cbSpy }
            );

            cbSpy.should.have.callCount(9);
            this.requireSpy.should.always.have.been.calledWithExactly(sinon.match.string);
        });

        it('should skip directories & files which are listed in the `except` collection option ', function() {
            var options = {
                except: [
                    this.tmpDir.name + '/modules/routes/v1.0/s2s',
                    this.tmpDir.name + '/modules/routes/v2.0/route6.js',
                ]
            };

            moduleLoader.loadModules(
                this.tmpDir.name + '/modules/',
                options
            );

            this.requireSpy.should.have.callCount(5);
        });
    });

    describe('getCachedModels', function() {

        before(function() {
            this.models = {};
            moduleLoader.__set__('models', this.models);
        });

        it('should return value of internal `models` dictionary', function() {
            var models = moduleLoader.getCachedModels();
            models.should.be.equal(this.models);
        });
    });
});
