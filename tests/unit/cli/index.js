var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var Vantage   = require('vantage');

var AppManager = require('../../../lib/express/appManager.js');
var App        = require('../../../lib/express/app.js');
var Config     = require('../mocks/config.js');
var CLI        = require('../../../lib/cli');
var commands   = require('../../../lib/cli/commands');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('CLI', function() {
    before(function() {
        this.models = {};
        this.config = new Config();

        this.appManager = new AppManager(this.config, this.models);
        var app = this.app = this.appManager.buildApp();
    });

    describe('constructor', function() {
        it('should have Vantage server object', function() {
            var cli = new CLI({
                apps: [this.app]
            });

            cli.should.have.property('server').that.is.an.instanceof(Vantage);
        });

        it('should register cli commands on server', function() {
            var cmdSpies = [];
            Object.keys(commands).forEach(function(name) {
                cmdSpies.push(sinon.spy(commands[name], 'build'));
            });

            var cli = new CLI({
                apps: [this.app]
            });

            cmdSpies.forEach(function(spy) {
                spy.should.have.been.calledOnce;
                spy.should.have.been.calledWith(cli);
            });
        });

        it('should throw an Error when we provide options.apps value that is not an array', function() {
            function test() {
                var cli = new CLI({
                    apps: this.app
                });
            }

            expect(test).to.throw(Error);
        });

        it('should throw an Error when options.apps contains value that is not instanceof App', function() {
            function test() {
                var cli = new CLI({
                    apps: ['invalid value']
                });
            }

            expect(test).to.throw(Error);
        });
    });

    describe('listen', function() {
        before(function() {
            this.cli = new CLI({
                apps: [this.app]
            });

            this.cliServerListenSpy = sinon.spy(this.cli.server, 'listen');
        });

        it('should call cli.server.listen with provided options', function() {
            var options = {
                ssl: false
            };

            this.cli.listen(0, options);

            this.cliServerListenSpy.should.have.been.calledOnce;
            this.cliServerListenSpy.should.have.been.calledWith(
                sinon.match.func,
                sinon.match(function(options) {
                    options.port = 0;
                    return options.should.be.eql(options);
                })
            );
        });

        it('should return self (cli)', function() {
            this.cli.listen(0).should.be.equal(this.cli);
        });
    });

    describe('show', function() {
        before(function() {
            this.cli = new CLI({
                apps: [this.app]
            });

            this.cliServerShowStub = sinon.stub(this.cli.server, 'show');
        });

        it('should call cli.server.show method', function() {
            this.cli.show();
            this.cliServerShowStub.should.have.been.calledOnce;
        });

        it('should return self (cli)', function() {
            this.cli.show().should.be.equal(this.cli);
        });
    });

    describe('command definition interface every command should implement', function() {
        before(function() {
            this.cli = new CLI({
                apps: [this.app]
            });
        });

        it('should return the Command object', function() {
            var self = this;

            Object.keys(commands).forEach(function(name) {
                var cmd = commands[name].build(self.cli);
                //we don't have access to the Command constructor
                Object.getPrototypeOf(cmd).constructor.name.should.be.equal('Command');
            });
        });

        it('(a command module) should export an `action` function', function() {
            Object.keys(commands).forEach(function(name, index) {
                commands[name].should.have.property('action').that.is.instanceof(Function);
            });
        });

        it('should assign `action` function to the Command object with explicitly set context (this) object to the cli object', function() {
            var self = this;

            Object.keys(commands).forEach(function(name, index) {
                var cmd = commands[name].build(self.cli);

                cmd._fn.toString().should.be.equal(commands[name].action(self.cli).toString());
            });
        });
    });
});
