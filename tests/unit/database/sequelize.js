var sinon        = require('sinon');
var chai         = require('chai');
var sinonChai    = require("sinon-chai");
var Sequelize    = require('@fogine/sequelize');

var sequelizeBuilder = require('../../../lib/database/sequelize.js');
var penetrator       = require('../../../lib/sequelize/penetrator.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('sequelizeBuilder', function() {
    it('should return new Sequelize object', function() {
        var sequelize = sequelizeBuilder({
            host: 'localhost',
            db: 'test',
            username: 'root',
            dialect: 'postgres'
        });

        sequelize.should.be.an.instanceof(Sequelize);
    });

    it('should build new Sequelize object with provided options', function() {
        var options = {
            host: 'localhost',
            db: 'test',
            username: 'root',
            password: 'test',
            dialect: 'postgres',
            pool: {
                min: 10,
                max: 100,
                idle: 10
            },
            ssl: true
        };

        var sequelize = sequelizeBuilder(options);

        sequelize.config.should.have.property('database', options.db);
        sequelize.config.should.have.property('username', options.username);
        sequelize.config.should.have.property('password', options.password);
        sequelize.config.should.have.property('host', options.host);
        sequelize.config.should.have.property('pool').that.is.eql(options.pool);
        sequelize.config.should.have.deep.property('dialectOptions.ssl', options.ssl);
    });

    it('should add cache support to the created sequelize object', function() {
        var spy = sinon.spy(penetrator, 'penetrateCacheSupport');

        var sequelize = sequelizeBuilder({
            host: 'localhost',
            db: 'test',
            username: 'root',
            dialect: 'postgres'
        });

        spy.should.have.been.calledOnce;
        spy.should.have.been.calledWithExactly(sequelize);

        spy.restore();
    });

    it('should NOT add cache support if the `cache` option is "disabled"', function() {
        var spy = sinon.spy(penetrator, 'penetrateCacheSupport');

        var sequelize = sequelizeBuilder({
            host: 'localhost',
            db: 'test',
            username: 'root',
            dialect: 'postgres',
            cache: false
        });

        spy.should.have.callCount(0);
        spy.restore();
    });

    it('should allow to define `classMethods` options', function() {

        var classMethods = {
            method1: function() {},
            method2: function() {},
            search: function() {},
        };

        var sequelize = sequelizeBuilder({
            host: 'localhost',
            db: 'test',
            username: 'root',
            dialect: 'postgres',
            classMethods: classMethods
        });

        sequelize.options.define.classMethods.should.have.property('method1', classMethods.method1);
        sequelize.options.define.classMethods.should.have.property('method2', classMethods.method2);
        sequelize.options.define.classMethods.should.have.property('search', classMethods.search);
    });

    it('should allow to define `instanceMethods` options', function() {
        var instanceMethods = {
            method1: function() {},
            method2: function() {},
            normalize: function() {},
        };

        var sequelize = sequelizeBuilder({
            host: 'localhost',
            db: 'test',
            username: 'root',
            dialect: 'postgres',
            instanceMethods: instanceMethods
        });

        sequelize.options.define.instanceMethods.should.have.property('method1', instanceMethods.method1);
        sequelize.options.define.instanceMethods.should.have.property('method2', instanceMethods.method2);
        sequelize.options.define.instanceMethods.should.have.property('normalize', instanceMethods.normalize);
    });
});
