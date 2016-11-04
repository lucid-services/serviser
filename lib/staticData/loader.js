/**
 * staticDataLoader
 * This module is supposed to be executed on it's own as a separated process
 * It prints json data to the stdout
 *
 * USAGE:
 *
 * node staticDataLoader [options]
 *
 * --path,
 *       collection of paths pointing to sequelize models
 * --config
 *       file path pointing to application's settings.conf.json
 */
var Promise = require('bluebird');
var config  = require('bi-config');
var argv    = require('minimist')(process.argv);

var moduleLoader     = require('../moduleLoader.js');
var sequelizeBuilder = require('../database/sequelize.js');

var modelPaths = argv.path && (Array.isArray(argv.path) && argv.path || [argv.path]);

if (!Array.isArray(modelPaths) || !modelPaths.length) {
    console.error(new Error("No model destination received. Can't load static data"));
    process.exit(1);
}
var sequelize = sequelizeBuilder(config.get('sequelize'));
var models = moduleLoader.loadORMmodels(modelPaths, sequelize);

var pool = {};

Object.keys(models).forEach(function(name) {
    var model = models[name];
    if (   model.hasOwnProperty('initStaticData')
        && model.initStaticData instanceof Function
    ) {
        pool[name] = model.initStaticData();
    }
});

Promise.props(pool).then(function(results){
    process.stdout.write(`${JSON.stringify(results)}\n`);
    process.exit(0);
}).catch(function(err){
    console.error(err);
    process.exit(1);
});
