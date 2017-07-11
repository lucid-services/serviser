var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");

var RequestError    = require('../../../lib/error/requestError.js');
var reqContentType  = require('../../../lib/middleware/requestContentType.js');
var Config          = require('../mocks/config.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('requestContentType middleware', function() {

    beforeEach(function() {
        this.config = new Config();

        this.res = {};
        this.req = {
            header: function() {}
        };
        this.next = sinon.spy();

        this.reqHeaderStub = sinon.stub(this.req, 'header');
        this.confGetStub = sinon.stub(this.config, 'getOrFail');
    });

    [
        {
            type: 'application/json',
            method: 'POST',
            supported: {
                json: {}
            }
        },
        {
            type: 'application/json',
            method: 'POST',
            supported: {
                json: {
                    type: 'application/json'
                }
            }
        },
        {
            type: 'application/x-www-form-urlencoded',
            method: 'POST',
            supported: {
                urlencoded: {}
            }
        },
        {
            type: undefined,
            method: 'GET',
            supported: {
                json: {}
            }
        }
    ].forEach(function(item, index) {
        it(`should PASS req content-type validation (${index})`, function() {

            var headerStub = this.reqHeaderStub.withArgs('content-type').returns(item.type);
            var confGetStub = this.confGetStub.withArgs('bodyParser').returns(item.supported);
            this.req.method = item.method;

            var context = {config: this.config};
            reqContentType.call(context, this.req, this.res, this.next);

            confGetStub.should.have.been.calledOnce;
            confGetStub.should.have.been.calledWith('bodyParser');
            this.next.should.have.been.calledOnce;
            this.next.should.have.been.calledWithExactly();
        });
    });

    [
        {
            type: 'json',
            method: 'GET',
            supported: {
                json: {type: 'application/json'}
            }
        },
        {
            type: 'urlencoded',
            method: 'POST',
            supported: {
                urlencoded: {type: 'application/x-www-form-urlencoded'}
            }
        },
        {
            type: 'application/json',
            method: 'POST',
            supported: {
                urlencoded: {type: 'application/x-www-form-urlencoded'}
            }
        },
        {
            type: 'application/x-www-form-urlencoded',
            method: 'POST',
            supported: {
                json: {type: 'application/json'}
            }
        },
    ].forEach(function(item, index) {
        it(`should FAIL req content-type validation (${index})`, function() {

            var headerStub = this.reqHeaderStub.withArgs('content-type').returns(item.type);
            var confGetStub = this.confGetStub.withArgs('bodyParser').returns(item.supported);
            this.req.method = item.method;

            var context = {config: this.config};
            reqContentType.call(context, this.req, this.res, this.next);

            confGetStub.should.have.been.calledOnce;
            confGetStub.should.have.been.calledWith('bodyParser');
            this.next.should.have.been.calledOnce;
            this.next.should.have.been.calledWithExactly(sinon.match.instanceOf(RequestError));
        });
    })
});
