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

var Promise      = require('bluebird');
var _            = require('lodash');
var CouchbaseODM = require('kouchbase-odm');
var config       = require('bi-config');
var argv         = require('minimist')(process.argv);

var moduleLoader     = require('../moduleLoader.js');
var sequelizeBuilder = require('../database/sequelize.js');
var CouchbaseCluster = require('../database/couchbase.js');

var ormModelPaths = argv['orm-path'] && (Array.isArray(argv['orm-path']) && argv['orm-path'] || [argv['orm-path']]);
var odmModelPaths = argv['odm-path'] && (Array.isArray(argv['odm-path']) && argv['odm-path'] || [argv['odm-path']]);
var bucketName = argv.bucket || 'main';

if (   (!Array.isArray(ormModelPaths) || !ormModelPaths.length)
    && (!Array.isArray(odmModelPaths) || !odmModelPaths.length)
) {
    console.error(new Error("No model destination received. Can't load static data"));
    process.exit(1);
}

var couchbaseCluster = CouchbaseCluster.build(config.get('storage:couchbase'));
var odm = new CouchbaseODM({
    bucket: couchbaseCluster.openBucketSync(bucketName)
});

var sequelizeOptions = _.cloneDeep(config.get('storage:postgres'));
sequelizeOptions.dialect = 'postgres';
var sequelize = sequelizeBuilder(sequelizeOptions);

if (Array.isArray(ormModelPaths)) {
    moduleLoader.loadORMmodels(ormModelPaths, sequelize);
}
if (Array.isArray(odmModelPaths)) {
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
