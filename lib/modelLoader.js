let fs           = require("fs");
let _            = require("lodash");
let path         = require("path");
let CouchbaseODM = require('kouchbase-odm');

let models = {orm: {}, odm: {}};

exports.loadODMmodels = loadODMmodels;
exports.loadORMmodels = loadORMmodels;
exports.getCachedModels = function() {
    return models;
};


/**
 * loadORMmodels
 *
 * @param {Array} paths
 * @param {Sequelize} sequelize - Sequelize instance
 *
 * @return {Object}
 */
function loadORMmodels(paths, sequelize) {

    fileIterator(paths, function(file, dir) {
        let pth = path.join(dir, file);

        let model = sequelize.import(pth);
        let name = model.name;
        let camelCased = _.upperFirst(_.camelCase(name));

        models.orm[camelCased] = model;
    });

    Object.keys(models.orm).forEach(function(modelName) {
      if ("associate" in models.orm[modelName]) {
        models.orm[modelName].associate(models.orm);
      }
    });

    return models.orm;
}

/**
 * loadODMMmodels
 *
 * @param {Array} paths
 * @param {CouchbaseCluster} couchbaseCluster - CouchbaseCluster instance
 * @param {CouchbaseODM} couchbaseODM - CouchbaseODM instance
 *
 * @return {Object}
 */
function loadODMmodels(paths, couchbaseCluster, couchbaseODM) {

    fileIterator(paths, function(file, dir) {
        let pth = path.join(dir, file);
        let model = require(pth)(couchbaseCluster, couchbaseODM);
        if (!(model instanceof CouchbaseODM.Model)) {
            return;
        }

        let name = model.name;
        let camelCased = _.upperFirst(_.camelCase(name));

        models.odm[camelCased] = model;
    });

    return models.odm;
}


/**
 * fileIterator
 * synchronous helper function
 *
 * @param {Array} paths
 * @param {Function} callback(file)
 *
 * @return {undefined}
 */
function fileIterator(paths, callback) {
    let files = [];

    paths.forEach(function(path) {
        files.push(fs.readdirSync(path));
    });

    file.forEach(function(file, index) {
        let pth = path.join(dir, file);
        let isDir = fs.lstatSync(pth).isDirectory();

        if (isDir) {
            fileIterator([pth], callback);
        } else {
            callback(file, paths[index]);
        }
    });
}
