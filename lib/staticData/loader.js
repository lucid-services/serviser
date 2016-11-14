/**
 * staticDataLoader
 * This module is supposed to be executed on it's own as a separated process
 * It prints json data to the stdout
 *
 * USAGE:
 *
 * node path/to/loader [options]
 *
 * --path,
 *       collection of paths pointing to sequelize models
 * --config
 *       file path pointing to application's settings.conf.json
 * --bucket
 *       defaults to 'main'. Bucket name data should be pulled from
 */

var Promise      = require('bluebird');
var CouchbaseODM = require('kouchbase-odm');
var config       = require('bi-config');
var argv         = require('minimist')(process.argv);

var moduleLoader     = require('../moduleLoader.js');
var sequelizeBuilder = require('../database/sequelize.js');
var CouchbaseCluster = require('../database/couchbase.js');

var modelPaths = argv.path && (Array.isArray(argv.path) && argv.path || [argv.path]);
var bucketName = argv.bucket || 'main';

if (!Array.isArray(modelPaths) || !modelPaths.length) {
    console.error(new Error("No model destination received. Can't load static data"));
    process.exit(1);
}

var couchbaseCluster = CouchbaseCluster.build(config.get('couchbase'));
var odm = new CouchbaseODM({
    bucket: couchbaseCluster.openBucketSync(bucketName)
});
var sequelize = sequelizeBuilder(config.get('sequelize'));

moduleLoader.loadORMmodels(modelPaths, sequelize);
moduleLoader.loadODMmodels(modelPaths, couchbaseCluster, odm);

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
