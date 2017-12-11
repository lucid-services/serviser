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

    describe('inspectIntegrity', function() {
        before(function() {
            this.inspectIntegritySpy = sinon.spy(this._resourceMock, 'inspectIntegrity');
        });

        beforeEach(function() {
            this.inspectIntegritySpy.reset();
        });

        after(function() {
            this.inspectIntegritySpy.restore();
        });

        describe('resource identifier is provided', function() {
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
        });

        describe('resource identifier is NOT provided', function() {
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
