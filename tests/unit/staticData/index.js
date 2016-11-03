var _              = require('lodash');
var rewire         = require('rewire');
var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var Promise        = require('bluebird');
var childProcess   = require('child_process');
var EventEmitter   = require('events').EventEmitter;

var staticData = rewire('../../../lib/staticData/index.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();


describe.only('static data', function() {
    describe('loadSync', function() {
        before(function() {
            this.spawnSyncStub = sinon.stub(childProcess, 'spawnSync');
        });

        beforeEach(function() {
            this.spawnSyncStub.reset();
        });

        after(function() {
            this.spawnSyncStub.restore();
        });

        it('should call the `spawnSync` method with correct arguments', function() {
            this.spawnSyncStub.returns({
                status: 0,
                stdout: 'null'
            });
            var cmd = require.resolve('../../../lib/staticData/loader.js');

            staticData.loadSync(['/path/to/file', '/path/to/dir/']);

            this.spawnSyncStub.should.have.been.calledOnce;
            this.spawnSyncStub.should.have.been.calledWith(
                'node ' + cmd,
                [
                    '--path /path/to/file',
                    '--path /path/to/dir/'
                ]
            );
        });

        it('should throw an Error when we get exit status code which is NOT equal 0', function() {
            var resolved = {
                status: 2,
                stderr: 'some error message'
            };

            this.spawnSyncStub.returns(resolved);

            expect(staticData.loadSync.bind(undefined, '/path/to/file'))
                .to.throw(Error).that.have.property('stderr', resolved.stderr);
        });

        it('should throw an Error when the error occurs while attempting to spawn a new process', function() {
            var resolved = {
                error: new Error
            };

            this.spawnSyncStub.returns(resolved);

            expect(staticData.loadSync.bind(undefined, '/path/to/file'))
                .to.throw(resolved.error);
        });

        it('should return parsed stdout json data', function() {
            this.spawnSyncStub.returns({
                status: 0,
                stdout: '{"some": "data"}'
            });

            var result = staticData.loadSync('/path/to/file');

            result.should.be.eql({some: 'data'});
        });
    });

    describe('load', function() {
        before(function() {
            this.spawnStub = sinon.stub(childProcess, 'spawn');
        });

        beforeEach(function() {
            delete this.process;

            this.process = new EventEmitter;
            this.process.stdout = new EventEmitter;
            this.process.stderr = new EventEmitter;

            this.spawnStub.reset();
            this.spawnStub.returns(this.process);
        });

        after(function() {
            this.spawnStub.restore();
        });

        it('should call the `spawn` method with correct arguments', function() {
            var cmd = require.resolve('../../../lib/staticData/loader.js');

            staticData.load(['/path/to/file', '/path/to/dir/']);

            this.spawnStub.should.have.been.calledOnce;
            this.spawnStub.should.have.been.calledWith(
                'node ' + cmd,
                [
                    '--path /path/to/file',
                    '--path /path/to/dir/'
                ]
            );
        });

        it('should return rejected promise with an Error when we get exit status code that is NOT equal 0', function() {
            var self = this;

            process.nextTick(function() {
                self.process.emit('close', 1);
            });

            return staticData.load('/path/to/file')
                .should.be.rejectedWith(sinon.match(function(err) {
                    return err instanceof Error && err.hasOwnProperty('stderr');
                }));
        });

        it('should return parsed stdout json data', function() {
            var self = this;

            process.nextTick(function() {
                self.process.stdout.emit('data', '{"some": "data"}');
                self.process.emit('close', 0);
            });

            return staticData.load('/path/to/file').should.become({some: 'data'});
        });
    });

    describe('get', function() {
        after(function() {
            staticData.__set__('staticData', undefined);
        });

        it('should convert provided model name to camel case notation', function() {
            staticData.__set__('staticData', {GroupType: {}});

            expect(staticData.get.bind(undefined, 'group_type')).to.not.throw(Error);
        });

        it("should return model's static data", function() {
            var data = {
                some: 'data'
            };

            staticData.__set__('staticData', {GroupType: data});

            staticData.get('GroupType').should.be.equal(data);
        });

        it('should throw an Error when data are not found for the specified model name', function() {
            staticData.__set__('staticData', {});

            expect(staticData.get.bind(undefined, 'group_type')).to.throw(Error);
        });
    });

    describe('getCommandArgs', function() {
        before(function() {
            this.getCommandArgs = staticData.__get__('getCommandArgs');
        });

        it('should accept a string argument value instead of an Array', function() {
            var input = '/some/path/to/file';

            var output = this.getCommandArgs(input);

            output.should.be.an.instanceof(Array);
        });

        it("should transform input array so that each string item is prefixed with `--path ` string", function() {
            var input = [
                '/path/to/file',
                './path/to/dir/'
            ];

            var output = this.getCommandArgs(input);

            output.should.be.an.instanceof(Array);
            output.should.include('--path ' + input[0]);
            output.should.include('--path ' + input[1]);
        });
    });
});
