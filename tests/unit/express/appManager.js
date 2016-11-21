var sinon          = require('sinon');
var chai           = require('chai');
var sinonChai      = require("sinon-chai");

var AppManager = require('../../../lib/express/appManager.js');
var Config     = require('../mocks/config.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('AppManager', function() {

    before(function() {
        this.models = {};
        this.config = new Config();
        this.appManager = new AppManager(this.models);
    });

    after(function() {
        delete this.models;
        delete this.config;
        delete this.appManger;
    });

    describe('add', function() {
        it('should fail when you provide invalid argument that is not instance of App', function() {
            var self = this;

            function testcase() {
                self.appManager.add({});
            }

            expect(testcase).to.throw(Error);
        });
    });

    describe('buildApp', function() {
        before(function() {
            this.options = {
                validator: {
                    failOnFirstErr: false
                }
            };
            this.app = this.appManager.buildApp(this.config, this.options);
        });

        after(function() {
            delete this.options;
            delete this.app;
        });

        it('should return new instance of App with correct initialization argument values', function() {
            this.app.config.should.be.equal(this.config);
            this.app.models.should.be.equal(this.models);
            this.app.appManager.should.be.equal(this.appManager);
            this.app.options.validator.should.have.property('failOnFirstErr', this.options.validator.failOnFirstErr);
        });

        it("should push App on top of the appManager's stack", function() {
            var appManager = this.app.appManager;
            expect(appManager.apps).to.include(this.app);
            expect(appManager.apps.indexOf(this.app)).to.be.equal(appManager.apps.length -1);
        });

    });
});
