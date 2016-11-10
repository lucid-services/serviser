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

chai.use(sinonChai);
chai.should();

describe('`using` command', function() {

    before(function() {
        this.models = {
            odm: {},
            orm: {}
        };
        this.config = new ConfigMock();

        this.appManager = new AppManager(this.config, this.models);

        var app = this.app = this.appManager.buildApp();
        var app2 = this.app2 = this.appManager.buildApp();

        app.server = new ServerMock;
        app2.server = new ServerMock;

        this.cli = new CLI({
            apps: [app, app2]
        });

        this.logStub = sinon.stub();
        this.logErrStub = sinon.stub();
        this.printAppsSpy = sinon.spy(lsCmd, 'printApps');

        usingCmd.__set__({
            console: {
                log: this.logStub,
                error: this.logErrStub
            }
        });

        this.action = usingCmd.action(this.cli);
    });

    beforeEach(function() {
        this.logStub.reset();
        this.logErrStub.reset();
        this.printAppsSpy.reset();

        this.cli.apps = [];
    });

    after(function() {
        this.printAppsSpy.restore();
    });

    describe('action', function() {
        it('should print an error when there are no apps connected to the cli', function() {
            this.action({}, sinon.spy());

            this.logErrStub.should.have.been.calledOnce;
            this.logErrStub.should.have.been.calledWith('No app connected');
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

            this.action({}, callbackSpy);

            callbackSpy.should.have.been.calledOnce;

            this.cli.apps.push(this.app2);
            this.action({}, callbackSpy);

            callbackSpy.should.have.been.calledTwice;
        });
    });
});
