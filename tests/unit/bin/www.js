var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var Promise   = require('bluebird');

var AppManager = require('../../../lib/express/appManager.js');
var App        = require('../../../lib/express/app.js');
var Config     = require('../mocks/config.js');
var service    = require('../../../index.js');
var www        = require('../../../bin/www');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('www', function() {

    before('prepare', function() {
        this.models = {odm: {}, orm: {}};
        this.config = new Config();

        this.appListenStub = sinon.stub(App.prototype, 'listen');
        this.serviceIntegrityStub = sinon.stub(service.serviceIntegrity, 'inspect').returns(Promise.resolve());
    });

    beforeEach(function() {
        this.appManager = new AppManager(this.models);
    });

    afterEach(function() {
        delete this.appManager;
        this.appListenStub.reset();
        this.serviceIntegrityStub.reset();
    });

    after(function() {
        this.appListenStub.restore();
        this.serviceIntegrityStub.restore();

        delete this.models;
        delete this.config;
        delete this.appManager;
        delete this.app;
    });

    it('should register `postInit` & `error` & `listening` event listeners for each app of the appManager', function(done) {
        var self = this;
        var doneCalled = false;

        this.appManager.buildApp(this.config, {name: '1'});
        this.appManager.buildApp(this.config, {name: '2'});

        www(this.appManager, this.config);

        self.appManager.apps.forEach(function(app, index, apps) {
            var listeners = app.listeners('post-init');
            listeners.should.have.lengthOf(1);
            listeners.pop().listener.should.be.equal(www.onPostInit);

            app.on('post-init', function(app) {
                try {
                    self.serviceIntegrityStub.should.have.been.calledWith(app);

                    var listeners = app.listeners('error');
                    listeners.should.include(www.onError);

                    listeners = app.listeners('listening');
                    listeners.should.include(www.onListening);

                    if (index == apps.length -1) {
                        done();
                    }
                } catch(e) {
                    if (!doneCalled) {
                        console.error(`App index: ${index}`);
                        doneCalled = true;
                        done(e);
                    }
                }
            });

        });
    });

    it('should call `serviceIntegrity.inspect(app)` && `app.listen()` with each app', function(done) {
        var self = this;
        var apps = this.appManager.apps;

        this.appManager.buildApp(this.config, {name: 'unittest-app'});
        this.appManager.buildApp(this.config, {name: 'unittest-app'});

        www(this.appManager, this.config);

        setTimeout(function() {
            try {
                self.serviceIntegrityStub.should.have.been.calledWith(apps.pop());
                self.serviceIntegrityStub.should.have.been.calledWith(apps.pop());
                self.appListenStub.should.have.been.calledTwice;
            } catch(e) {
                return done(e);
            }
            done();
        }, 200)
    });
});
