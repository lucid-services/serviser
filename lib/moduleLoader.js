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
 * @param {Array|String} paths - collection of files/directories, or single string path
 * @param {Sequelize}    sequelize - Sequelize instance
 * @param {Object}       [options]
 * @param {Array}        [options.except] - collection of files/directories that should be excluded
 *
 * @return {Object}
 */
function loadORMmodels(paths, sequelize, options) {

    var dict = {};

    fileIterator(paths, options, function(file, dir) {
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
 * loadODMmodels
 *
 * @param {Array|String} paths - collection of files/directories, or single string path
 * @param {Array}        [args] - arguments passed to the exported module builder function
 * @param {Object}       [options]
 * @param {Array}        [options.except] - collection of files/directories that should be excluded
 *
 * @return {Object}
 */
function loadODMmodels(paths, args, options) {

    var dict = {};

    fileIterator(paths, options, function(file, dir) {
        var pth = path.join(dir, file);
        var model = require(pth).apply(undefined, args);
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
 * @param {Array|String} paths - collection of files/dirrectories, or single string path
 * @param {Object} [options]
 * @param {Array}  [options.except] - collection of files/directories that should be excluded
 */
function loadModules(paths, options) {

    fileIterator(paths, options, function(file, dir) {
        var pth = path.join(dir, file);
        require(pth);
    });
}


/**
 * fileIterator
 * synchronous helper function
 *
 * @param {Array|String} paths
 * @param {Object} [options]
 * @param {Array} [options.except] - collection of files/directories that should be excluded
 * @param {Function} callback(file)
 *
 * @return {undefined}
 */
function fileIterator(paths, options, callback) {
    var filePacks = [];
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    if (typeof paths === 'string') {
        paths = [paths];
    }

    options = options || {};
    var except = [];

    //normalize paths
    (options.except || []).forEach(function(p) {
        except.push(path.resolve(p));
    });

    paths.forEach(function(path) {
        filePacks.push(fs.readdirSync(path));
    });

    filePacks.forEach(function(files, index) {
        files.forEach(function(file) {
            var pth = path.join(paths[index], file);
            var isDir = fs.lstatSync(pth).isDirectory();

            //skip paths defined in options.except array
            if (except.indexOf(pth) !== -1) {
                return;
            }

            if (isDir) {
                fileIterator([pth], options, callback);
            } else {
                callback(file, paths[index]);
            }
        });
    });
}
