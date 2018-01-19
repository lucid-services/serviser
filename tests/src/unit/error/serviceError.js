var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");

var ServiceError = require('../../../../lib/error/serviceError.js');
var RequestError = require('../../../../lib/error/requestError.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('ServiceError', function() {

    it('should accept object argument', function() {
        var obj = {test: 'test'};
        var err = new ServiceError(obj);

        err.should.have.property('context', obj);
    });

    it('should accept string argument', function() {
        var str = 'test';
        var err = new ServiceError(str);

        err.should.have.property('context').that.is.eql({message: str});
    });

    describe('toLogger', function() {
        it('should return an object with context property', function() {
            var err = new ServiceError('test');

            err.toLogger().should.have.property('context').that.is.eql({
                message: 'test'
            });
        });
    });

    describe('setOrigin', function() {
        it('should set `routeUID` property of context objectc', function() {
            var err = new ServiceError();
            err.setOrigin('test');
            err.context.should.have.property('routeUID', 'test');
        });
    });

    describe('buildFrom', function() {
        it('should return a new ServiceError object', function() {
            var e = new RequestError('test');

            var err = ServiceError.buildFrom(e);

            err.should.be.instanceof(ServiceError);

            err.should.have.deep.property('context.message', 'test');
            err.stack.should.be.equal(e.stack);
        });

        it('should return a new ServiceError object with additional context object properties', function() {
            var e = new RequestError('test');

            var err = ServiceError.buildFrom(e, {
                another: 'value',
                and: 'another'
            });

            err.should.be.instanceof(ServiceError);

            err.should.have.deep.property('context.message', 'test');
            err.should.have.deep.property('context.another', 'value');
            err.should.have.deep.property('context.and', 'another');
            err.stack.should.be.equal(e.stack);
        });
    });
});
