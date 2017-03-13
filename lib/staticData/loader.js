/**
 * staticDataLoader
 * This module is supposed to be executed on it's own as a separated process
 * It prints json data to the stdout
 *
 * USAGE:
 *
 * node path/to/loader [options]
 *
 * --orm-path,
 *       collection of paths pointing to sequelize models
 * --odm-path,
 *       collection of paths pointing to couchbaseODM models
 * --config
 *       file path pointing to application's settings.conf.json
 * --bucket
 *       defaults to 'main'. Bucket name data should be pulled from
 */

var Promise = require('bluebird');
var _       = require('lodash');
var config  = require('bi-config');
var argv    = require('minimist')(process.argv);

var moduleLoader = require('../moduleLoader.js');

var ormModelPaths = argv['orm-path'] && (Array.isArray(argv['orm-path']) && argv['orm-path'] || [argv['orm-path']]);
var odmModelPaths = argv['odm-path'] && (Array.isArray(argv['odm-path']) && argv['odm-path'] || [argv['odm-path']]);

if (   (!Array.isArray(ormModelPaths) || !ormModelPaths.length)
    && (!Array.isArray(odmModelPaths) || !odmModelPaths.length)
) {
    console.error(new Error("No model destination received. Can't load static data"));
    process.exit(1);
}

if (Array.isArray(ormModelPaths)) {
    var psqlOptions = config.get('storage:postgres')
    ,   sequelizeBuilder = require('../database/sequelize.js')
    ,   sequelize = sequelizeBuilder(sequelizeOptions);

    var sequelizeOptions = {
        dialect  : 'postgres',
        host     : psqlOptions.host,
        ssl      : psqlOptions.ssl,
        db       : psqlOptions.databases.staticData.db,
        username : psqlOptions.databases.staticData.username,
        password : psqlOptions.databases.staticData.password
    };

    moduleLoader.loadORMmodels(ormModelPaths, sequelize);
}
if (Array.isArray(odmModelPaths)) {
    var CouchbaseCluster = require('../database/couchbase.js')
    ,   CouchbaseODM     = require('kouchbase-odm')
    ,   couchbaseCluster = CouchbaseCluster.build(config.get('storage:couchbase'))
    ,   bucketName       = argv.bucket || 'main'
    ,   odm              = new CouchbaseODM({
        bucket: couchbaseCluster.openBucketSync(bucketName)
    });

    moduleLoader.loadODMmodels(odmModelPaths, [couchbaseCluster, odm]);
}

var models = moduleLoader.getCachedModels();

var pool = {};

Object.keys(models).forEach(function(modelType) {
    var localPool = {};

    Object.keys(models[modelType]).forEach(function(name) {
        var model = models[modelType][name];
        if (   model.hasOwnProperty('initStaticData')
            && model.initStaticData instanceof Function
        ) {
            localPool[name] = model.initStaticData();
        }
    });

    pool[modelType] = Promise.props(localPool);
});

Promise.props(pool).then(function(results){
    process.stdout.write(`${JSON.stringify(results)}\n`);
    process.exit(0);
}).catch(function(err){
    console.error(err);
    process.exit(1);
});
