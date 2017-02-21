var rewire         = require('rewire');
var sinon          = require('sinon');
var chai           = require('chai');
var sinonChai      = require("sinon-chai");

var App              = require('../../../../lib/express/app.js');
var AppManager       = require('../../../../lib/express/appManager.js');
var ConfigMock       = require('../../mocks/config.js');
var ServerMock       = require('../../mocks/server.js');
var CLI              = require('../../../../lib/cli');
var lsCmd            = rewire('../../../../lib/cli/commands/ls.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('`ls` command', function() {
    before(function() {
        this.models = {
            odm: {},
            orm: {}
        };
        this.config = new ConfigMock();

        this.appManager = new AppManager(this.models);

        var app = this.app = this.appManager.buildApp(this.config, {name: 'public'});
        var app2 = this.app2 = this.appManager.buildApp(this.config, {name: 'private'});

        app.server = new ServerMock;
        app2.server = new ServerMock;

        this.cli = new CLI({
            appManager: this.appManager
        });

        var router = app.buildRouter({
            version: '1.0',
            url: '/'
        });

        var router2 = app.buildRouter({
            version: '2.0',
            url: '/'
        });

        var route = router.buildRoute({
            url: '/app',
            type: 'get'
        });

        route.validate({
            $is: Object
        }, 'body');
        route.main(sinon.spy());

        var route2 = router2.buildRoute({
            url: '/app2',
            type: 'get'
        });

        route2.validate({
            $is: Object
        }, 'body');

        router2.buildRoute({
            url: '/app2',
            type: 'post'
        });

        router2.buildRoute({
            url: '/del',
            type: 'delete'
        });

        this.logStub = sinon.spy();

        this.action = lsCmd.action(this.cli).bind({
            log: this.logStub
        });
    });

    beforeEach(function() {
        this.logStub.reset();
    });

    describe('action', function() {
        before(function() {
            this.printAppsSpy = sinon.spy(lsCmd, 'printApps');
            this.printRoutesSpy = sinon.spy(lsCmd, 'printRoutes');
        });

        after(function() {
            this.printAppsSpy.restore();
            this.printRoutesSpy.restore();
        });

        beforeEach(function() {
            this.printAppsSpy.reset();
            this.printRoutesSpy.reset();
        });

        describe('list apps', function() {
            it('should print available app list', function() {
                this.action({options: {apps: true}}, sinon.spy());

                this.printAppsSpy.should.have.been.calledOnce;
                this.printAppsSpy.should.have.been.calledWith(this.cli.options.apps);

                this.logStub.should.have.been.calledOnce;
                this.logStub.should.have.been.calledWith(
                    this.printAppsSpy.firstCall.returnValue
                );
            });

            it('should call the callback', function() {
                var callbackSpy = sinon.spy();
                this.action({options: {apps: true}}, callbackSpy);

                callbackSpy.should.have.been.calledOnce;
            });
        });

        describe('list routes', function() {
            it('should print all routes of connected apps', function() {
                //connect apps to cli
                this.cli.apps = [this.app, this.app2];

                this.action({options: {routes: true}, filter: []}, sinon.spy());

                this.printRoutesSpy.should.have.been.calledOnce;
                this.printRoutesSpy.should.have.been.calledWith(this.cli.apps);

                this.logStub.should.have.been.calledOnce;
                this.logStub.should.have.been.calledWith(
                    this.printRoutesSpy.firstCall.returnValue
                );

                //disconnect all apps
                this.cli.apps = [];
            });

            it('should print an error when there is no app connected', function() {
                var self = this;

                function testCase() {
                    self.action({options: {routes: true}, filter: []}, sinon.spy());
                }

                expect(testCase).to.throw(Error);
            });
        });
    });

    describe('printApps', function() {
        it('should return a string printing a table WITH header', function() {
            var output = lsCmd.printApps([
                this.app,
                this.app2,
            ], {
                header: true
            });

            var port = this.app.server.address().port;
            var port2 = this.app2.server.address().port;

            var expected = `ID  NAME     PORT  STATUS\n` +
                           `--  -------  ----  ------\n` +
                           `0   public   ${port }  init  \n` +
                           `1   private  ${port2}  init  \n`

            output.should.be.equal(expected);
        });

        it('should return a string printing a table WITHOUT header', function() {
            var output = lsCmd.printApps([
                this.app,
                this.app2,
            ], {
                header: false
            });

            var expected = `0  public   ${this.app.server.address().port }  init\n`+
                           `1  private  ${this.app2.server.address().port}  init\n`;

            output.should.be.equal(expected);
        });

        it('should not fail when an app server is not running', function() {
            var self = this;
            var serverBck = this.app.server;
            this.app.server = null;

            function testCase() {
                return lsCmd.printApps([
                    self.app,
                    self.app2,
                ], {
                    header: false
                });
            }

            expect(testCase).to.not.throw(Error);

            this.app.server = serverBck;
        });

    });

    describe('printRoutes', function() {
        it('should return string listing routes', function() {
            var output = lsCmd.printRoutes([
                this.app,
                this.app2,
            ]);

            var expected = 'GET     /app   getApp_v1.0     main validator\n'+
                           'GET     /app2  getApp2_v2.0    validator     \n'+
                           'POST    /app2  postApp2_v2.0                 \n'+
                           'DELETE  /del   deleteDel_v2.0                \n';

            output.should.be.equal(expected);
        });

        describe('filter list', function() {
            it('should filter route list by HTTP method', function() {
                var output = lsCmd.printRoutes([
                    this.app,
                    this.app2,
                ], {
                    filter: {
                        method: 'get'
                    }
                });

                var expected = 'GET  /app   getApp_v1.0   main validator\n'+
                               'GET  /app2  getApp2_v2.0  validator     \n';

                output.should.be.equal(expected);
            });

            it('should filter route list by url', function() {
                var output = lsCmd.printRoutes([
                    this.app,
                    this.app2,
                ], {
                    filter: {
                        url: 'app2'
                    }
                });

                var expected = 'GET   /app2  getApp2_v2.0   validator\n'+
                               'POST  /app2  postApp2_v2.0           \n';

                output.should.be.equal(expected);
            });

            it('should filter route list by route UID', function() {
                var output = lsCmd.printRoutes([
                    this.app,
                    this.app2,
                ], {
                    filter: {
                        uid: 'v2.0'
                    }
                });

                var expected = 'GET     /app2  getApp2_v2.0    validator\n'+
                               'POST    /app2  postApp2_v2.0            \n'+
                               'DELETE  /del   deleteDel_v2.0           \n';

                output.should.be.equal(expected);
            });

            it('should filter route list by route method & url & uid', function() {
                var output = lsCmd.printRoutes([
                    this.app,
                    this.app2,
                ], {
                    filter: {
                        method: 'get|post',
                        url: 'app2',
                        uid: 'get'
                    }
                });

                var expected = 'GET  /app2  getApp2_v2.0  validator\n';

                output.should.be.equal(expected);
            });
        });

        describe('sort order', function() {

            it('should sort route list in correct order', function() {
                var output = lsCmd.printRoutes([
                    this.app,
                    this.app2,
                ], {
                    sort: 'm' //sort by route's (m)ethod
                });

                var expected = 'DELETE  /del   deleteDel_v2.0                \n'+
                               'GET     /app   getApp_v1.0     main validator\n'+
                               'GET     /app2  getApp2_v2.0    validator     \n'+
                               'POST    /app2  postApp2_v2.0                 \n';

                output.should.be.equal(expected);
            });
        });
    });
});
