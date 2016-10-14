var Sequelize  = require('@fogine/sequelize');
var penetrator = require('../sequelize/penetrator.js');

module.exports = sequelizeBuilder;

var logging = false;
var env = process.env;

if ( !env.SEQUELIZE_DEBUG && (!env.NODE_ENV || env.NODE_ENV == 'local')) {
    env.SEQUELIZE_DEBUG = true;
}

if (env.SEQUELIZE_DEBUG && JSON.parse(env.SEQUELIZE_DEBUG)) {
    logging = console.log;
}


/**
 * sequelizeBuilder
 *
 * @param {Object}  options
 * @param {String}  options.db
 * @param {String}  options.username
 * @param {String}  options.password
 * @param {String}  options.host
 * @param {Boolean} options.ssl
 * @param {Integer} options.pool.max
 * @param {Integer} options.pool.min
 * @param {Integer} options.pool.idle
 * @param {Integer} options.dialect
 *
 * @return {undefined}
 */
function sequelizeBuilder(options) {

    var sequelize =  new Sequelize(options.db, options.username, options.password, {
        host: options.host,
        dialect: options.dialect,
        logging: logging,
        dialectOptions: {
            ssl: options.ssl
        },
        pool: {
            max  : 10,
            min  : 0,
            idle : 10000
        },
        define: {
            underscored     : true,
            freezeTableName : true, //Do not transform table names into plural form
            charset         : 'utf8',
            collate         : 'utf8_general_ci',
            classMethods    : penetrator.classMethods,
            instanceMethods : penetrator.instanceMethods
        }
    });

    penetrator.penetrateCacheSupport(sequelize);

    return sequelize;
}

sequelizeBuilder.Sequelize = Sequelize;
