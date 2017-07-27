var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var Config    = require('bi-config');

var Service        = require('../../../lib/service.js');
var appStatusCheck = require('../../../lib/middleware/appStatusCheck.js');
var AppManager     = require('../../../lib/express/appManager.js');
var AppStatus      = require('../../../lib/express/appStatus.js');
var ServiceError   = require('../../../lib/error/serviceError.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('appStatusCheck middleware', function() {

    before(function() {
        this.config = new Config.Config;

        this.service = new Service(this.config);
        this.appManager = this.service.appManager;
        var app = this.app = this.appManager.buildApp(this.config, {name: '1'});

        this.res = {};
        this.req = {};
        this.next = sinon.spy();

    });

    beforeEach(function() {
        this.app.status = AppStatus.OK;
        this.next.reset();
    });

    it('should call the `next` callback with a ServiceError when the App is in the `ERROR` state', function() {
        this.app.status = AppStatus.ERROR;
        appStatusCheck.call(this.app, this.req, this.res, this.next);

        this.next.should.have.been.calledOnce;
        this.next.should.have.been.calledWithExactly(sinon.match(function(err) {
            return err instanceof ServiceError;
        }));
    });

    it('should call the `next` callback when the App is NOT in the `ERROR` state', function() {
        appStatusCheck.call(this.app, this.req, this.res, this.next);

        this.next.should.have.been.calledOnce;
        this.next.should.have.been.calledWithExactly();
    });
});
