var rewire         = require('rewire');
var sinon          = require('sinon');
var chai           = require('chai');
var sinonChai      = require("sinon-chai");
var chaiAsPromised = require('chai-as-promised');
var Vantage        = require('vantage');
var Promise        = require('bluebird');

var App              = require('../../../../lib/express/app.js');
var CLI              = require('../../../../lib/cli');
var serviceIntegrity = require('../../../../lib/serviceIntegrity.js');
var integrityCmd     = rewire('../../../../lib/cli/commands/integrity.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('`integrity` command', function() {
    before(function() {
        //fake app
        var app = this.app = Object.create(App.prototype);
        var app2 = this.app2 = Object.create(App.prototype);

        this.cli = new CLI({
            apps: [app, app2]
        });
    });

    describe('action', function() {
        before(function() {
            this.serviceIntegrityInspectStub = sinon.stub(serviceIntegrity, 'inspect');
            this.logStub = sinon.stub();
            this.logErrStub = sinon.stub();

            this.consoleStubRevert = integrityCmd.__set__({
                console: {
                    log: this.logStub,
                    error: this.logErrStub
                }
            });

            this.action = integrityCmd.action(this.cli);
        });

        after(function() {
            this.serviceIntegrityInspectStub.restore();
            this.consoleStubRevert();
        });

        beforeEach(function() {
            this.serviceIntegrityInspectStub.reset();
            this.logStub.reset();
            this.logErrStub.reset();
            this.cli.apps = [];
        });

        it('should log an error when there is no app connected to the cli', function() {
            this.action({}, sinon.spy());

            this.logErrStub.should.have.been.calledOnce;
            this.logErrStub.should.have.been.calledWith(sinon.match.string);

            this.serviceIntegrityInspectStub.should.have.callCount(0);
            this.logStub.should.have.callCount(0);
        });

        it('should log an error when unexpected exception occurs', function(done) {
            var self = this;
            var err = new Error('test');

            this.cli.apps.push(this.app);
            this.serviceIntegrityInspectStub.returns(Promise.reject(err))

            this.action({}, function() {
                self.logErrStub.should.have.been.calledOnce;
                self.logErrStub.should.have.been.calledWith(err.stack);
                done();
            });
        });

        it('should call serviceIntegrity.inspect for each connected app', function(done) {
            var self = this;
            this.serviceIntegrityInspectStub.returns(Promise.resolve({}));

            this.cli.apps.push(this.app);
            this.cli.apps.push(this.app2);

            this.action({}, function() {
                self.serviceIntegrityInspectStub.should.have.been.calledTwice;
                self.serviceIntegrityInspectStub.should.have.been.calledWith(self.app);
                self.serviceIntegrityInspectStub.should.have.been.calledWith(self.app2);
                done();
            });
        });

        it('should print the results of inspection', function(done) {
            var self = this;
            var outputData = {some: 'data'};

            var printSpy = sinon.spy(integrityCmd, 'print');

            this.serviceIntegrityInspectStub.returns(Promise.resolve(outputData));

            this.cli.apps.push(this.app);

            this.action({}, function() {
                printSpy.should.have.been.calledOnce;
                self.logStub.should.have.been.calledWith(printSpy.firstCall.returnValue);
                printSpy.restore();
                done();
            });
        });
    });

    describe('print', function() {
        it('should return correctly formated string', function() {
            var data = [
                {
                    node: 'node',
                    couchbase: 'couchbase',
                    postgres: 'postgres'
                },
                {
                    node: 'node2',
                    couchbase: 'couchbase2',
                    postgres: 'postgres2'
                }
            ];

            var output = integrityCmd.print(data);

            var expected = 'APP  NODE   COUCHBASE   POSTGRES \n' +
                            '---  -----  ----------  ---------\n' +
                            '0    node   couchbase   postgres \n' +
                            '1    node2  couchbase2  postgres2\n';
            output.should.be.equal(expected);
        });
    });
});
