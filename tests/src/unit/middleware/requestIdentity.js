var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var Config    = require('bi-config');

var Service         = require('../../../../lib/service.js');
var requestIdentity = require('../../../../lib/middleware/requestIdentity.js');
var AppManager      = require('../../../../lib/appManager.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('requestIdentity middleware', function() {

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
        this.next.reset();
    });

    it('should set `UID` property on the `req` object', function() {
        requestIdentity.call(this.app, this.req, this.res, this.next);

        this.req.UID.should.be.a('number');

        this.next.should.have.been.calledOnce;
    });
});
