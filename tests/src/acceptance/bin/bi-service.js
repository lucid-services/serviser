const _              = require('lodash');
const findPorts      = require('find-port');
const tmp            = require('tmp');
const json5          = require('json5');
const fs             = require('fs');
const path           = require('path');
const sinon          = require('sinon');
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai      = require("sinon-chai");
const Promise        = require('bluebird');
const spawn          = require('child_process').spawn;

const biServicePath = path.resolve(__dirname + '/../../../../bin/bi-service.js');
const MOCK_APP_ROOT = path.resolve(__dirname + '/../../../mocks/app');
const MOCK_APP_CONFIG_PATH = path.resolve(__dirname + '/../../../mocks/app/config.json5');
const BI_SERVICE_VERSION = require('../../../../package.json').version;

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised', Promise);

// adds .json5 loader require.extension
require('json5/lib/require');

const expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('bin/bi-service', function() {
    before(function() {
        var self = this;
        this.spawn = _spawn;
        this.portAvailable = function(port) {
            return new Promise(function(resolve, reject) {
                findPorts('127.0.0.1', [port], function(ports) {
                    ports = ports || [];

                    if (~ports.indexOf(port)) {
                        return resolve(true);
                    }
                    return resolve(false);
                });
            });
        };

        /**
         * @param {Array}   args
         * @param {Object}  [options]
         * @param {Integer} [options.port]
         * @param {String}  [options.cwd]
         */
        function _spawn(args, options) {
            options = options || {};
            args = args || [];
            args.unshift(biServicePath);

            return new Promise(function(resolve, reject) {
                var stdout = ''
                ,   stderr = ''
                ,   port   = options.port
                ,   intervalID = null;

                if (port === undefined && ~args.indexOf('apps.app1.listen')) {
                    port = args[args.indexOf('apps.app1.listen') + 1];
                }

                if (typeof port === 'number') {
                    intervalID = setInterval(killOnTCPUnavailable, 125);
                }

                var proc = spawn('node', args, {
                    cwd: options.cwd || MOCK_APP_ROOT
                });

                proc.stdout.on('data', function (data) {
                    stdout += data.toString().trim();
                });

                proc.stderr.on('data', function (data) {
                    stderr += data.toString().trim();
                });

                proc.on('exit', function (code) {
                    if (code !== 0 && code !== null) {
                        let err = new Error(`${stderr}\nprocess exited with code: ${code}`);
                        err.code = code;
                        err.stderr = stderr;
                        return reject(err);
                    }
                    return resolve({
                        stdout: stdout,
                        code: code
                    });
                });

                function killOnTCPUnavailable() {
                    self.portAvailable(port).then(function(available) {
                        if (!available) {
                            clearInterval(intervalID);
                            proc.stdin.pause();
                            proc.kill();
                        }
                    });
                }
            });
        }
    });

    describe('run/server/start service', function() {
        before(function(done) {
            var self = this;

            tmp.setGracefulCleanup();
            this.tmpDir = tmp.dirSync({unsafeCleanup: true});

            findPorts('127.0.0.1', 8000, 8010, function(ports) {
                self.port = ports.shift();

                var conf = require(MOCK_APP_CONFIG_PATH);
                conf.apps.app1.listen = self.port;

                fs.writeFile(
                    `${self.tmpDir.name}/config.json5`,
                    JSON.stringify(conf),
                    function(err) {
                        if (err) {
                            return done(err);
                        }
                        done();
                    });
            });
        });

        it('should start a nodejs server with given port', function() {
            return this.spawn([
                'run',
                '--config',
                MOCK_APP_CONFIG_PATH,
                'apps.app1.listen',
                this.port
            ]).should.be.fulfilled;
        });

        it('should exit with 1 when the start command is run outside of project directory (invalid project)', function() {
            return this.spawn([
                'run',
                '--config',
                MOCK_APP_CONFIG_PATH
            ], {
                cwd: __dirname
            }).should.be.rejected.then(function(err) {
                err.stderr.should.match(/Could not confirm that cwd is a bi-service project/);
            });
        });

        it('should start a nodejs server in cluster mode', function() {
            return this.spawn([
                'run',
                '--cluster',
                '--config',
                MOCK_APP_CONFIG_PATH,
                'apps.app1.listen',
                this.port
            ]).should.be.fulfilled;
        });

        describe('--parse-pos-args', function() {
            describe('when disabled', function() {
                it('should ignore shell positional arguments (which would otherwise overwrite config file option values)', function() {
                    return this.spawn([
                        'run',
                        '--config',
                        `${this.tmpDir.name}/config.json5`,
                        '--parse-pos-args',
                        false,
                        'apps.app1.listen',
                        'invalid'
                    ], {port: this.port}).should.be.fulfilled;
                });
            });

            describe('when enabled', function() {
                it('should exit with 1 when we provide invalid number of positional args', function() {
                    return this.spawn([
                        'run',
                        '--config',
                        MOCK_APP_CONFIG_PATH,
                        'couchbase.host',
                        '"127.0.0.3"',
                        'another.config.option.with.no.value'
                    ]).should.be.rejected.then(function(err) {
                        err.code.should.be.equal(1);
                    });
                });
            });
        });
    });

    describe('--version', function() {
        it('should dump bi-service version tag to stdout', function() {
            return this.spawn([
                '--version',
            ]).should.be.fulfilled.then(function(result) {
                result.stdout.should.be.equal(BI_SERVICE_VERSION);
                result.code.should.be.equal(0);
            });
        });
    });

    describe('--get-conf', function() {
        it('should print option value', function() {
            return this.spawn([
                '--config',
                MOCK_APP_CONFIG_PATH,
                '--get-conf',
                'apps.app1.bodyParser.json.type'
            ]).should.be.fulfilled.then(function(result) {
                result.code.should.be.equal(0);
                result.stdout.should.be.eql('application/json');
            });
        });

        it('should print option value', function() {
            return this.spawn([
                '--config',
                MOCK_APP_CONFIG_PATH,
                '--get-conf',
            ]).should.be.fulfilled.then(function(result) {
                result.code.should.be.equal(0);
                json5.parse(result.stdout).should.be.eql({
                    apps: {
                        app1: {
                            baseUrl: 'http://127.0.0.1',
                            listen: 5903,
                            bodyParser: {
                                json: {
                                    extended: true,
                                    type: 'application/json',
                                    limit: "2mb"
                                }
                            },
                        }
                    },
                    fileConfigPath: MOCK_APP_CONFIG_PATH,
                    type: 'literal'
                });
            });
        });

        it('should exit with 1 and print "undefined" when there is not such option', function() {
            return this.spawn([
                '--config',
                MOCK_APP_CONFIG_PATH,
                '--get-conf',
                'some.options.which.does.not.exist'
            ]).should.be.rejected.then(function(result) {
                result.code.should.be.equal(1);
                result.stderr.should.be.equal('undefined');
            });
        });
    });

    describe('--json5 option', function() {
        it('should print json data in json5 format', function() {
            return this.spawn([
                '--config',
                MOCK_APP_CONFIG_PATH,
                '--get-conf',
                'apps.app1.bodyParser',
                '--json5'
            ]).should.be.fulfilled.then(function(result) {
                var stdout = result.stdout;
                result.code.should.be.equal(0);

                stdout.should.be.equal('{\n'          +
                '    json: {\n'                       +
                '        extended: true,\n'           +
                '        type: "application/json",\n' +
                '        limit: "2mb"\n'              +
                '    }\n'                             +
                '}');
            });
        });
    });

    describe('--offset option', function() {
        it('should print json data with correct space offset set', function() {
            return this.spawn([
                '--config',
                MOCK_APP_CONFIG_PATH,
                '--get-conf',
                'apps.app1.bodyParser',
                '--json5',
                '--offset',
                '2'
            ]).should.be.fulfilled.then(function(result) {
                var stdout = result.stdout;
                result.code.should.be.equal(0);

                stdout.should.be.equal('{\n'      +
                '  json: {\n'                     +
                '    extended: true,\n'           +
                '    type: "application/json",\n' +
                '    limit: "2mb"\n'              +
                '  }\n'                           +
                '}');
            });
        });

        it('should replace space character with given string value in JSON output', function() {
            return this.spawn([
                '--config',
                MOCK_APP_CONFIG_PATH,
                '--get-conf',
                'apps.app1.bodyParser',
                '--json5',
                '--offset',
                '__'
            ]).should.be.fulfilled.then(function(result) {
                var stdout = result.stdout;
                result.code.should.be.equal(0);

                stdout.should.be.equal('{\n'      +
                '__json: {\n'                     +
                '____extended: true,\n'           +
                '____type: "application/json",\n' +
                '____limit: "2mb"\n'              +
                '__}\n'                           +
                '}');
            });
        });
    });
});
