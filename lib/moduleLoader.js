var fs           = require("fs");
var _            = require("lodash");
var path         = require("path");
var CouchbaseODM = require('kouchbase-odm');

var models = {orm: {}, odm: {}};

exports.loadODMmodels   = loadODMmodels;
exports.loadORMmodels   = loadORMmodels;
exports.loadModules     = loadModules;
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

    var dict = {};

    fileIterator(paths, function(file, dir) {
        var pth = path.join(dir, file);

        var model = sequelize.import(pth);
        var name = model.name;
        var camelCased = _.upperFirst(_.camelCase(name));

        dict[camelCased] = models.orm[camelCased] = model;
    });

    Object.keys(dict).forEach(function(modelName) {
      if ("associate" in dict[modelName]) {
        dict[modelName].associate(models.orm);
      }
    });

    return dict;
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

    var dict = {};

    fileIterator(paths, function(file, dir) {
        var pth = path.join(dir, file);
        var model = require(pth)(couchbaseCluster, couchbaseODM);
        if (!(model instanceof CouchbaseODM.Model)) {
            return;
        }

        var name = model.name;
        var camelCased = _.upperFirst(_.camelCase(name));

        dict[camelCased] = models.odm[camelCased] = model;
    });

    return dict;
}

/**
 * loadModules
 *
 * @param {Array} paths
 */
function loadModules(paths) {

    fileIterator(paths, function(file, dir) {
        var pth = path.join(dir, file);
        var model = require(pth);
    });
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
    var filePacks = [];

    paths.forEach(function(path) {
        filePacks.push(fs.readdirSync(path));
    });

    filePacks.forEach(function(files, index) {
        files.forEach(function(file) {
            var pth = path.join(paths[index], file);
            var isDir = fs.lstatSync(pth).isDirectory();

            if (isDir) {
                fileIterator([pth], callback);
            } else {
                callback(file, paths[index]);
            }
        });
    });
}
