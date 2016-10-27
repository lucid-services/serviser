var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var logger    = require('bi-logger');

var RouteNotFoundError = require('../../../lib/error/routeNotFoundError.js');
var routeNotFound      = require('../../../lib/middleware/routeNotFound.js');
var AppManager         = require('../../../lib/express/appManager.js');
var Config             = require('../mocks/config.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('routeNotFound middleware', function() {

    before(function() {
        this.models = {};
        this.config = new Config();

        this.appManager = new AppManager(this.config, this.models);
        var app = this.app = this.appManager.buildApp();

        this.res = {};
        this.req = {};
        this.next = sinon.spy();

    });

    beforeEach(function() {
        this.next.reset();
    });

    it('should call the `next` callback with RouteNotFoundError if the response headers have not been sent yet', function() {
        routeNotFound.call(this.app, this.req, this.res, this.next);

        this.next.should.have.been.calledOnce;
        this.next.should.have.been.calledWith(sinon.match(function(err) {
            return err instanceof RouteNotFoundError;
        }));
    });

    it('should do nothing (?)', function() {
        this.res.headersSent = true;

        routeNotFound.call(this.app, this.req, this.res, this.next);

        this.next.should.have.callCount(0);
    });
});
