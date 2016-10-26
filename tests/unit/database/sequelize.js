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
});
