var rewire    = require('rewire');
var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var tmp       = require('tmp');

var moduleLoader = rewire('../../../lib/moduleLoader.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe.only('moduleLoader', function() {

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

        it('should support explicit file path as well as directory path', function() {
            moduleLoader.loadModules([
                this.tmpDir.name + '/modules/routes/v1.0',
                this.tmpDir.name + '/modules/routes/v2.0/route4.js'
            ]);

            this.requireSpy.should.have.callCount(7);
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
});
