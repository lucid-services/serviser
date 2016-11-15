var _         = require('lodash');
var rewire    = require('rewire');
var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");

var App        = require('../../../../lib/express/app.js');
var AppManager = require('../../../../lib/express/appManager.js');
var CLI        = require('../../../../lib/cli');
var ConfigMock = require('../../mocks/config.js');
var ServerMock = require('../../mocks/server.js');
var useCmd     = rewire('../../../../lib/cli/commands/use.js');

chai.use(sinonChai);
chai.should();

describe('`use` command', function() {

    before(function() {
        this.models = {
            odm: {},
            orm: {}
        };
        this.config = new ConfigMock();

        this.appManager = new AppManager(this.config, this.models);

        var app = this.app = this.appManager.buildApp({name: 'public'});
        var app2 = this.app2 = this.appManager.buildApp({name: 'private'});

        app.server = new ServerMock;
        app2.server = new ServerMock;

        this.cli = new CLI({
            appManager: this.appManager
        });

        this.logStub = sinon.stub();
        this.logErrStub = sinon.stub();

        this.consoleStubRevert = useCmd.__set__({
            console: {
                log: this.logStub,
                error: this.logErrStub
            }
        });

        this.action = useCmd.action(this.cli);
    });

    beforeEach(function() {
        this.logStub.reset();
        this.logErrStub.reset();

        this.cli.apps = [];
    });

    after(function() {
        this.consoleStubRevert();
    });

    describe('action', function() {
        it('(`use *`) should connect all available apps to the cli', function() {
            this.action({apps: '*'}, sinon.spy());

            this.cli.apps.should.have.lengthOf(2);
            this.cli.apps[0].should.be.equal(this.app);
            this.cli.apps[1].should.be.equal(this.app2);
        });

        it('should disconnect all currently conected apps and connect the one specified', function() {
            this.action({
                apps: this.app.server.address().port
            }, sinon.spy());

            this.cli.apps.should.have.lengthOf(1);
            this.cli.apps.should.include(this.app);
        });

        it('should disconnect all currently conected apps and connect the one specified (string identifier)', function() {
            this.action({
                apps: this.app2.options.name
            }, sinon.spy());

            _.compact(this.cli.apps).should.have.lengthOf(1);
            this.cli.apps.should.include(this.app2);
        });

        it('should log an Invalid argument error', function() {
            this.action({apps: ''}, sinon.spy());

            this.logErrStub.should.have.been.calledOnce;
            this.logErrStub.should.have.been.calledWith(sinon.match(function(message) {
                return ~message.indexOf('Invalid argument');
            }, 'Invalid argument'));
        });

        it('should call the callback', function() {
            var callbackSpy = sinon.spy();

            this.action({apps: '*'}, callbackSpy);

            callbackSpy.should.have.been.calledOnce;

            this.action({
                apps: this.app.server.address().port
            }, callbackSpy);

            callbackSpy.should.have.been.calledTwice;
        });
    });

});
