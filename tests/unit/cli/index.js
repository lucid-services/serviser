var sinon          = require('sinon');
var chai           = require('chai');
var sinonChai      = require("sinon-chai");
var chaiAsPromised = require('chai-as-promised');
var Vantage        = require('vantage');

var AppManager = require('../../../lib/express/appManager.js');
var App        = require('../../../lib/express/app.js');
var Config     = require('../mocks/config.js');
var CLI        = require('../../../lib/cli');
var commands   = require('../../../lib/cli/commands');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('CLI', function() {
    before(function() {
        this.models = {};
        this.config = new Config();

        this.appManager = new AppManager(this.models);
        var app = this.app = this.appManager.buildApp(this.config);
    });

    describe('constructor', function() {
        it('should have Vantage server object', function() {
            var cli = new CLI({
                appManager: this.appManager
            });

            cli.should.have.property('server').that.is.an.instanceof(Vantage);
        });

        it('should register cli commands on server', function() {
            var cmdSpies = [];
            Object.keys(commands).forEach(function(name) {
                cmdSpies.push(sinon.spy(commands[name], 'build'));
            });

            var cli = new CLI({
                appManager: this.appManager
            });

            cmdSpies.forEach(function(spy) {
                spy.should.have.been.calledOnce;
                spy.should.have.been.calledWith(cli);
                spy.restore();
            });
        });

        it('should throw an Error when we provide options.appManager that is not an instanceof AppManager', function() {
            function test() {
                var cli = new CLI({
                    appManager: this.appManager
                });
            }

            expect(test).to.throw(Error);
        });
    });

    describe('close', function() {
        before(function() {
            this.cli = new CLI({
                appManager: this.appManager
            });

            //TODO causes the npm run coverage to print [ERROR]
            //event though all tests pass
            this.cli.listen(3100);

            this.cliServerCloseStub = sinon.stub(this.cli.server.server.server, 'close');
        });

        beforeEach(function() {
            this.cliServerCloseStub.reset();
        });

        after(function() {
            this.cliServerCloseStub.restore();
        });

        it('should return fulfilled promise', function() {
            this.cliServerCloseStub.yields();

            return this.cli.close().should.become(this.cli);
        });

        it('should return rejected promise', function() {
            var error = new Error('server.close test');
            this.cliServerCloseStub.yields(error);

            return this.cli.close().should.be.rejectedWith(error);
        });
    });

    describe('listen', function() {
        before(function() {
            this.cli = new CLI({
                appManager: this.appManager
            });

            this.cliServerListenSpy = sinon.spy(this.cli.server, 'listen');
        });

        beforeEach(function() {
            this.cliServerListenSpy.reset();
        });

        after(function() {
            this.cliServerListenSpy.restore();
            return this.cli.close();
        });

        it('should call cli.server.listen with provided options', function(done) {
            var self = this;
            var options = {
                ssl: false
            };

            //TODO causes the npm run coverage to print [ERROR]
            //event though all tests pass
            this.cli.on('listening', function listening() {
                self.cliServerListenSpy.should.have.been.calledOnce;
                self.cliServerListenSpy.should.have.been.calledWith(
                    sinon.match.func,
                    sinon.match(function(options) {
                        options.port = 3101;
                        return options.should.be.eql(options);
                    })
                );
                self.cli.removeListener('listening', listening);
                done();
            });
            this.cli.listen(3101, options);

        });

        it('should return self (cli)', function() {
            //TODO causes the npm run coverage to print [ERROR]
            //event though all tests pass
            this.cli.listen(3102).should.be.equal(this.cli);
        });
    });

    describe('show', function() {
        before(function() {
            this.cli = new CLI({
                appManager: this.appManager
            });

            this.cliServerShowStub = sinon.stub(this.cli.server, 'show');
        });

        after(function() {
            this.cliServerShowStub.restore();
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
                appManager: this.appManager
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
