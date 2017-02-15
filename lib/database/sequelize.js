var _          = require('lodash');
var Sequelize  = require('sequelize');
var penetrator = require('../sequelize/penetrator.js');

module.exports = sequelizeBuilder;

var logging = false;
var env = process.env;

//enable sequelize debug on `local` environment by default
if ( !env.SEQUELIZE_DEBUG && (!env.NODE_ENV || env.NODE_ENV == 'local')) {
    env.SEQUELIZE_DEBUG = true;
}

try {
    if (   env.SEQUELIZE_DEBUG === undefined
        || ( env.SEQUELIZE_DEBUG
        && ~[1,0,true,false].indexOf(JSON.parse(env.SEQUELIZE_DEBUG)) )
    ) {
        logging = console.log;
    } else {
        throw new SyntaxError;
    }
} catch(e) {
    console.warn('Failed to parse SEQUELIZE_DEBUG environment variable. Thus the option is disabled. Expects boolean value which can also be represented by 0/1 integer values.');
}


/**
 * sequelizeBuilder
 *
 * @param {Object}   options
 * @param {String}   options.db
 * @param {String}   options.username
 * @param {String}   options.password
 * @param {String}   options.host
 * @param {Boolean}  options.ssl
 * @param {Integer}  options.pool.max
 * @param {Integer}  options.pool.min
 * @param {Integer}  options.pool.idle
 * @param {Integer}  options.dialect
 * @param {Object}   [options.classMethods]
 * @param {Object}   [options.instanceMethods]
 * @param {Object}   [options.cache=true]
 * @param {Function} [options.logging=console.log]
 *
 * @return {undefined}
 */
function sequelizeBuilder(options) {

    var defaults = {
        pool: {
            max: 10,
            min: 0,
            idle: 10000
        },
        cache: true
    };

    options = _.merge(defaults, options);

    var sequelize = new Sequelize(options.db, options.username, options.password, {
        host: options.host,
        dialect: options.dialect,
        logging: options.logging ? logging && options.logging : logging,
        dialectOptions: {
            ssl: options.ssl
        },
        pool: {
            max  : options.pool.max,
            min  : options.pool.min,
            idle : options.pool.idle
        },
        define: {
            underscored     : true,
            freezeTableName : true, //Do not transform table names into plural form
            charset         : 'utf8',
            collate         : 'utf8_general_ci',
            classMethods    : _.assign(penetrator.classMethods, options.classMethods),
            instanceMethods : _.assign(penetrator.instanceMethods, options.instanceMethods)
        }
    });

    if (options.cache) {
        penetrator.penetrateCacheSupport(sequelize);
    }

    return sequelize;
}

sequelizeBuilder.Sequelize = Sequelize;
