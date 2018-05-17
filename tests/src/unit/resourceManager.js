const sinon          = require('sinon');
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai      = require("sinon-chai");
const Promise        = require('bluebird');

const ResourceManager = require('../../../lib/resourceManager.js');
const ServiceError    = require('../../../lib/error/serviceError.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('ResourceManager', function() {
    before(function() {
        this._resourceMock = {
            inspectIntegrity: function() {
                return Promise.resolve();
            }
        };

        this._resourceMock2 = {
            inspectIntegrity: function() {
                return Promise.resolve();
            }
        };
    });

    beforeEach(function() {
        this.resourceManager = new ResourceManager;
    });

    describe('get', function() {
        it('should return requested resource object', function() {
            this.resourceManager.add('my-resource', this._resourceMock);

            this.resourceManager.get('my-resource').should.be.equal(this._resourceMock);
        });

        it('should throw an Error when requested resource is not found', function() {
            var manager = this.resourceManager;

            expect(function() {
                manager.get('my-resource');
            }).to.throw(Error);
        });
    });

    describe('remove', function() {
        it('should remove the resource object from registry and return the removed resource', function() {
            this.resourceManager.add('my-resource', this._resourceMock);

            this.resourceManager.resources.should.have.property('my-resource');
            this.resourceManager.remove('my-resource').should.be.equal(this._resourceMock);
            this.resourceManager.resources.should.not.have.property('my-resource');
        });

        it('should return undefined when we try to remove resource which does not exist', function() {
            expect(this.resourceManager.remove('unknown-resource')).to.be.equal(undefined);
        });
    });

    describe('has', function() {
        it('should return true if a resource is registered with provided name in the manager', function() {
            this.resourceManager.add('my-resource', this._resourceMock);

            this.resourceManager.has('my-resource').should.be.equal(true);
        });

        it('should return false if a resource is not registered in the manager', function() {
            expect(this.resourceManager.has('unknown-resource')).to.be.equal(false);
        });
    });

    describe('register/add', function() {
        it('should register received resource under provided key', function() {
            this.resourceManager.register('my-resource', this._resourceMock);

            this.resourceManager.resources.should.have.property('my-resource', this._resourceMock);
        });

        it('should throw a TypeError when received resource object does not implement required methods', function() {
            var manager = this.resourceManager;

            expect(function() {
                manager.register('my-resource', {});
            }).to.throw(TypeError);
        });
    });

    describe('tag', function() {
        it('should tag registered resources with provided label', function() {
            this.resourceManager.register('my-resource', this._resourceMock);
            this.resourceManager.register('my-resource2', this._resourceMock);

            this.resourceManager.tag('my-resource', 'tag-name', 'tag-name2');
            this.resourceManager.tag('my-resource2', 'tag-name2');

            this.resourceManager.tags.should.have.property('tag-name').that.is.eql([
                'my-resource'
            ]);
            this.resourceManager.tags.should.have.property('tag-name2').that.is.eql([
                'my-resource',
                'my-resource2',
            ]);
        });

        it('should assign default tags to all registered resources', function() {
            this.resourceManager.register('my-resource', this._resourceMock);
            this.resourceManager.register('my-resource2', this._resourceMock);

            this.resourceManager.tags.should.have.property('*').that.is.eql([
                'my-resource',
                'my-resource2',
            ]);

            //all resource are assigned default tag which is equal to resource name/key
            this.resourceManager.tags.should.have.property('my-resource').that.is.eql([
                'my-resource'
            ]);
            this.resourceManager.tags.should.have.property('my-resource2').that.is.eql([
                'my-resource2'
            ]);
        });
    });

    describe('inspectIntegrity', function() {
        before(function() {
            this.inspectIntegritySpy = sinon.spy(this._resourceMock, 'inspectIntegrity');
            this.inspectIntegritySpy2 = sinon.spy(this._resourceMock2, 'inspectIntegrity');
        });

        beforeEach(function() {
            this.inspectIntegritySpy.reset();
            this.inspectIntegritySpy2.reset();
        });

        after(function() {
            this.inspectIntegritySpy.restore();
            this.inspectIntegritySpy2.restore();
        });

        describe('tag is provided', function() {
            beforeEach(function() {
                this.resourceManager.add('resource', this._resourceMock);
            });

            it('should return resolved promise with status object', function() {
                return this.resourceManager.inspectIntegrity('resource').then(function(status) {
                    status.should.have.property('resource');
                }).should.be.fulfilled;
            });

            it('should call the `inspectIntegrity` method on the `resource` resource', function() {
                var self = this;
                return this.resourceManager.inspectIntegrity('resource').then(function() {
                    self.inspectIntegritySpy.should.have.been.calledOnce;
                });
            });

            it('should NOT call the `inspectIntegrity` method on resources that are NOT assigned given tag', function() {
                const self = this;
                this.resourceManager.add('resource2', this._resourceMock2);
                return this.resourceManager.inspectIntegrity('resource2').then(function() {
                    self.inspectIntegritySpy.should.have.been.callCount(0);
                });
            });

            it('should NOT call the `inspectIntegrity` method on resources that are assigned given tag', function() {
                const self = this;
                this.resourceManager.add('resource2', this._resourceMock2);
                this.resourceManager.add('resource2b', this._resourceMock2);

                this.resourceManager.tag('resource2', 'common-tag');
                this.resourceManager.tag('resource2b', 'common-tag');

                return this.resourceManager.inspectIntegrity('common-tag', {
                    mode: 'exclude'
                }).then(function() {
                    self.inspectIntegritySpy.should.have.been.callCount(1);
                    self.inspectIntegritySpy2.should.have.been.callCount(0);
                });
            });
        });

        describe('no resource with given tag does NOT exist', function() {
            it('should return resolved promise', function() {
                return this.resourceManager.inspectIntegrity(
                    'tag-which-does-not-exist'
                ).bind(this).then(function() {
                    this.inspectIntegritySpy.should.have.callCount(0);
                    this.inspectIntegritySpy2.should.have.callCount(0);
                }).should.be.fulfilled;
            });
        });

        describe('tag is NOT provided', function() {
            beforeEach(function() {
                this.resourceManager.add('resource', this._resourceMock);
                this.resourceManager.add('resource2', this._resourceMock);
                this.resourceManager.add('resource3', this._resourceMock);
            });

            it('should return resolved promise with status object', function() {
                return this.resourceManager.inspectIntegrity().then(function(status) {
                    status.should.have.property('resource');
                    status.should.have.property('resource2');
                    status.should.have.property('resource3');
                }).should.be.fulfilled;
            });

            it('should call the `inspectIntegrity` method on each registered resource', function() {
                var self = this;
                return this.resourceManager.inspectIntegrity().then(function() {
                    self.inspectIntegritySpy.should.have.been.calledThrice;
                });
            });

            it('should return rejected Promise with a ServiceError when any resource integrity check fails', function() {
                var err = new Error('test');
                this.resourceManager.add('resource4', {inspectIntegrity: function() {
                    return Promise.reject(err);
                }});

                return this.resourceManager.inspectIntegrity().should.be.rejected
                .then(function(status) {
                    status.should.be.instanceof(ServiceError);
                    status.context.should.have.property('resource');
                    status.context.should.have.property('resource2');
                    status.context.should.have.property('resource3');
                    status.context.should.have.property('resource4', err.toString());
                }).should.be.fulfilled;
            });
        });
    });
});
