var rewire         = require('rewire');
var sinon          = require('sinon');
var chai           = require('chai');
var sinonChai      = require("sinon-chai");

var App        = require('../../../../lib/express/app.js');
var AppManager = require('../../../../lib/express/appManager.js');
var CLI        = require('../../../../lib/cli');
var ConfigMock = require('../../mocks/config.js');
var ServerMock = require('../../mocks/server.js');
var lsCmd      = require('../../../../lib/cli/commands/ls.js');
var usingCmd   = rewire('../../../../lib/cli/commands/using.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('`using` command', function() {

    before(function() {
        this.models = {
            odm: {},
            orm: {}
        };
        this.config = new ConfigMock();

        this.appManager = new AppManager(this.models);

        var app = this.app = this.appManager.buildApp(this.config);
        var app2 = this.app2 = this.appManager.buildApp(this.config);

        app.server = new ServerMock;
        app2.server = new ServerMock;

        this.cli = new CLI({
            appManager: this.appManager
        });

        this.logStub = sinon.stub();
        this.printAppsSpy = sinon.spy(lsCmd, 'printApps');

        this.action = usingCmd.action(this.cli).bind({
            log: this.logStub
        });
    });

    beforeEach(function() {
        this.logStub.reset();
        this.printAppsSpy.reset();

        this.cli.apps = [];
    });

    after(function() {
        this.printAppsSpy.restore();
    });

    describe('action', function() {
        it('should print an error when there are no apps connected to the cli', function() {
            var self = this;

            function testCase() {
                self.action({}, sinon.spy());
            }

            expect(testCase).to.throw(Error);
        });

        it('should print table of connected apps to the cli', function() {
            this.cli.apps.push(this.app);
            this.cli.apps.push(this.app2);

            this.action({}, sinon.spy());

            this.printAppsSpy.should.have.been.calledOnce;
            this.logStub.should.have.been.calledOnce;
            this.logStub.should.have.been.calledWith(
                this.printAppsSpy.firstCall.returnValue.toString()
            );
        });

        it('should call the callback', function() {
            var callbackSpy = sinon.spy();

            this.cli.apps.push(this.app2);
            this.action({}, callbackSpy);

            callbackSpy.should.have.been.calledOnce;
        });
    });
});
