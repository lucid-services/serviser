var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var logger    = require('serviser-logger');
var Config    = require('serviser-config');

var Service      = require('../../../../lib/service.js');
var errorHandler = require('../../../../lib/middleware/errorHandler.js');
var AppManager   = require('../../../../lib/appManager.js');
var AppStatus    = require('../../../../lib/common/appStatus.js');
var ServiceError = require('../../../../lib/error/serviceError.js');
var RequestError = require('../../../../lib/error/requestError.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('errorHandler middleware', function() {

    before(function() {
        this.config = new Config.Config;

        this.service = new Service(this.config);
        this.service.on('error', function noop() {});
        this.appManager = this.service.appManager;
        var app = this.app = this.appManager.buildApp(this.config, {name: '1'});

        this.appSetStatusSpy = sinon.spy(this.app, '$setStatus');
        this.appEmitSpy = sinon.spy(this.app, 'emit');
        this.loggerStub = sinon.stub(logger, 'error');
        this.errorSetUIDSpy = sinon.spy(RequestError.prototype, 'setUID');
        this.errorHandlerSpy = sinon.spy(errorHandler, 'errorHandler');

        this.res = {
            status: sinon.stub(),
            json: sinon.stub()
        };

        this.req = {
            UID: 1341234,
            routeUID: 'uid',
        };

        this.next = sinon.spy();

        //
        this.UnknownError = function UnknownError() {
            Error.call(this); //super constructor
            Error.captureStackTrace(this, this.constructor);

            this.success = false;
            this.name    = this.constructor.name;
        }

        this.UnknownError.prototype = Object.create(Error.prototype);
        this.UnknownError.prototype.constructor = this.UnknownError;

    });

    beforeEach(function() {
        this.appSetStatusSpy.reset();
        this.appEmitSpy.reset();
        this.res.status.reset();
        this.res.json.reset();
        this.next.reset();
        this.loggerStub.reset();
        this.errorSetUIDSpy.reset();
        this.errorHandlerSpy.reset();

        this.res.status.returns(this.res);
        this.res.json.returns(this.res);
    });

    after(function() {
        this.appSetStatusSpy.restore();
        this.loggerStub.restore();
        this.errorSetUIDSpy.restore();
        this.appEmitSpy.restore();
    });

    it('should call the errorHandler with a ServiceError when we get an error of "null" value', function() {
        errorHandler.call(this.app, null, this.req, this.res, this.next);
        this.errorHandlerSpy.should.have.been.calledOnce;
        this.errorHandlerSpy.should.have.been.calledWith(sinon.match(function(val) {
            return val instanceof ServiceError;
        }));
    });

    it('should return json response with correct status code when we get RequestError', function(done) {
        const self = this;
        const error = new RequestError({
            message: 'test message'
        });

        errorHandler.call(this.app, error, this.req, this.res, this.next);

        setTimeout(function() {
            self.res.status.should.have.been.calledOnce;
            self.res.status.should.have.been.calledWith(error.code);

            self.res.json.should.have.been.calledOnce;
            self.res.json.should.have.been.calledWith(error);
            done();
        }, 20)
    });

    it('should set correct status code and emit the `error-response` event when we get RequestError and at least one listener is registered for the event', function(done) {
        var self = this;
        var error = new RequestError({
            message: 'test message'
        });

        var errResponseListenerSpy = sinon.spy();
        this.app.on('error-response', errResponseListenerSpy);

        errorHandler.call(this.app, error, this.req, this.res, this.next);

        setTimeout(function() {
            self.res.status.should.have.been.calledOnce;
            self.res.status.should.have.been.calledWith(error.code);


            self.res.status.should.have.been.calledBefore(errResponseListenerSpy);
            errResponseListenerSpy.should.have.been.calledOnce;
            errResponseListenerSpy.should.have.been.calledWith(error, self.res);

            self.app.removeListener('error-response', errResponseListenerSpy);
            done();
        }, 20);
    });

    it('should return json response with 500 status code when we get ServiceError', function(done) {
        var self = this;
        var error = new ServiceError({});

        errorHandler.call(this.app, error, this.req, this.res, this.next);

        setTimeout(function() {
            self.res.status.should.have.been.calledOnce;
            self.res.status.should.have.been.calledWith(500);

            self.res.json.should.have.been.calledOnce;
            self.res.json.should.have.been.calledWith(error);
            done();
        }, 50);
    });

    it('should write an error to the log file when we get a ServiceError', function() {
        var error = new ServiceError({});

        errorHandler.call(this.app, error, this.req, this.res, this.next);

        this.errorSetUIDSpy.should.have.been.calledBefore(this.loggerStub);
        this.loggerStub.should.have.been.calledOnce;
        this.loggerStub.should.have.been.calledWithExactly(error);
    });

    it('should set origin ServiceError `context.routeUID`', function() {
        var error = new ServiceError();

        errorHandler.call(this.app, error, this.req, this.res, this.next);

        error.context.should.have.property('routeUID', 'uid');
    });

    it('should set status of application to the `ERROR` status when we get a ServiceError', function() {
        var error = new ServiceError({});

        errorHandler.call(this.app, error, this.req, this.res, this.next);

        this.appSetStatusSpy.should.have.been.calledOnce;
        this.appSetStatusSpy.should.have.been.calledWithExactly(AppStatus.ERROR, error);
    });

    it('should return unique request identifier in the json response when we get a ServiceError', function(done) {
        var self = this;
        var error = new ServiceError({});

        errorHandler.call(this.app, error, this.req, this.res, this.next);

        setTimeout(function() {
            self.res.json.should.have.been.calledOnce;
            self.res.json.should.have.been.calledWith(sinon.match(function(err) {
                return err.uid === self.req.UID;
            }));
            done();
        }, 20);
    });

    it('should emit the `unknown-error` event when it gets an error object which is not recognized', function() {
        var error = new this.UnknownError();
        var unknownErrorListenerSpy = sinon.spy();

        this.app.on('unknown-error', unknownErrorListenerSpy);

        errorHandler.call(this.app, error, this.req, this.res, this.next);

        unknownErrorListenerSpy.should.have.been.calledOnce;
        unknownErrorListenerSpy.should.have.been.calledWithExactly(error, sinon.match.func);

        this.app.removeAllListeners('unknown-error');
    });

    it('should convert an error to the ServiceError when we do not process it correctly in the `unknown-error` event listener', function() {
        var error = new this.UnknownError();

        this.app.on('unknown-error', function(err, errorHandler) {
            //we are supposed to conver the error to the RequestError here,
            //lets break the assumption and just return what we've got
            errorHandler(err);
        });

        errorHandler.call(this.app, error, this.req, this.res, this.next);

        this.errorHandlerSpy.should.have.been.calledOnce;
        this.errorHandlerSpy.should.have.been.calledWith(sinon.match(function(err) {
            return err instanceof ServiceError;
        }), this.req, this.res);

        this.app.removeAllListeners('unknown-error');
    });

    it('should convert an error to the ServiceError when it gets an error object which is not recognized and no `unknown-error` listener is listening', function() {
        var error = new this.UnknownError();

        errorHandler.call(this.app, error, this.req, this.res, this.next);

        this.errorHandlerSpy.should.have.been.calledOnce;
        this.errorHandlerSpy.should.have.been.calledWith(sinon.match(function(err) {
            return err instanceof ServiceError;
        }), this.req, this.res);
    });

    it('should convert an error to the ServiceError when it gets the error which is dirrect instanceof the Error', function() {
        var error = new Error;

        errorHandler.call(this.app, error, this.req, this.res, this.next);

        this.errorHandlerSpy.should.have.been.calledOnce;
        this.errorHandlerSpy.should.have.been.calledWith(sinon.match(function(err) {
            return err instanceof ServiceError;
        }), this.req, this.res);
    });
});
