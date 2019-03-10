var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var Config    = require('serviser-config');

var Service    = require('../../../../lib/service.js');
var AppManager = require('../../../../lib/appManager.js');
var App        = require('../../../../lib/express/app.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('AppManager', function() {

    beforeEach(function() {
        this.config = new Config.Config;
        this.service = new Service(this.config);
        this.appManager = this.service.appManager;
        this.appManagerEmitSpy = sinon.spy(this.appManager, 'emit');
    });

    afterEach(function() {
        delete this.config;
        delete this.appManager;
        this.appManagerEmitSpy.restore();
    });

    describe('add', function() {
        it('should fail when you provide invalid argument that is not instance of App', function() {
            var self = this;

            function testcase() {
                self.appManager.add({});
            }

            expect(testcase).to.throw(Error);
        });

        it('should fail when an another app with same name is already registered', function() {
            var self = this;
            var app = new App(this.appManager, this.config, {name: 'app'});
            var app2 = new App(this.appManager, this.config, {name: 'app'});
            //
            this.appManager.add(app);
            //
            expect(function() {
                self.appManager.add(app2);
            }).to.throw(Error);
        });

        it('should register given App', function() {
            var self = this;
            var app = new App(this.appManager, this.config, {name: 'app'});
            //
            this.appManager.add(app);
            //
            this.appManager.apps.should.include(app);
        });
    });

    describe('get', function() {

        it('should return App object', function() {
            var app = new App(this.appManager, this.config, {name: 'app'});
            this.appManager.add(app);

            this.appManager.get('app').should.be.equal(app);
        });

        it('should fail when an App with provided name does not exists', function() {
            var self = this;

            expect(function() {
                self.appManager.get('app');
            }).to.throw(Error);
        });
    });

    describe('buildApp', function() {
        beforeEach(function() {
            this.options = {
                name: '1',
                validator: {
                    failOnFirstErr: false
                }
            };
            this.app = this.appManager.buildApp(this.config, this.options);
        });

        afterEach(function() {
            delete this.options;
            delete this.app;
        });

        it('should return new instance of App with correct initialization argument values', function() {
            this.app.config.should.be.equal(this.config);
            this.app.appManager.should.be.equal(this.appManager);
            this.app.options.validator.should.have.property('failOnFirstErr', this.options.validator.failOnFirstErr);
        });

        it("should push App on top of the appManager's stack", function() {
            var appManager = this.app.appManager;
            expect(appManager.apps).to.include(this.app);
            expect(appManager.apps.indexOf(this.app)).to.be.equal(appManager.apps.length -1);
        });

        it('should emit `build-app` event with a new App', function() {
            this.appManagerEmitSpy.should.have.been.calledOnce;
            this.appManagerEmitSpy.should.have.been.calledWith('build-app', this.app);
        });
    });
});
