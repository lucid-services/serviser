var _            = require('lodash');
var Promise      = require('bluebird');
var childProcess = require('child_process');

/**
 * @type {Object}
 */
var staticData;
/**
 * @type {Array}
 */
var loadFnOptionsCache;

/**
 * loadSync
 *
 * @param {Object} modelPaths
 * @param {Array|String} modelPaths.orm
 * @param {Array|String} modelPaths.odm
 *
 * @return {Object}
 */
module.exports.loadSync = function(modelPaths){
    loadFnOptionsCache = Array.prototype.slice.call(arguments, 0);

    var args = getCommandArgs(modelPaths);
    args.unshift(__dirname + '/loader.js');

    var result = childProcess.spawnSync('node', args);

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        var err = new Error('Static data loader exited with status code: ' + result.status + '. Output: ' + result.output.toString());
        err.stderr = result.stderr;
        throw err;
    }


    try {
        staticData = JSON.parse(result.stdout.toString());
    } catch(e) {
        throw new Error('Expected application static data in valid JSON format: ' + e.message);
    }
    return staticData;
};

/**
 * load
 *
 * @param {Object} modelPaths
 * @param {Array|String} modelPaths.orm
 * @param {Array|String} modelPaths.odm
 *
 * @return {Promise<Object>}
 */
module.exports.load = Promise.method(function(modelPaths){
    loadFnOptionsCache = Array.prototype.slice.call(arguments, 0);

    return new Promise(function(resolve, reject) {
        var args = getCommandArgs(modelPaths);
        args.unshift(__dirname + '/loader.js');

        var proc = childProcess.spawn('node', args);
        var stdout = '';
        var stderr = '';

        proc.stdout.on('data', function(data) {
            stdout += data.toString();
        });

        proc.stderr.on('data', function(data) {
            stderr += data.toString();
        });
        proc.on('close', function(code) {
            if (code !== 0) {
                var err = new Error('Static data loader exited with status code: ' + code);
                err.stderr = stderr;
                return reject(err);
            }

            try {
                staticData = JSON.parse(stdout);
            } catch(e) {
                return reject(new Error('Expected application static data in valid JSON format: ' + e.message));
            }
            return resolve(staticData);
        });
    });
});

/**
 * returns collection of function arguments which were lastly used to load static data
 *
 * @return {Array}
 */
module.exports.$getLastLoadOptions = function() {
    return loadFnOptionsCache;
};

/**
 * get
 *
 * @param {String} path
 *
 * @return {mixed}
 */
module.exports.get = function(path) {
    if (!path) {
        return staticData;
    }

    if(!staticData || !_.has(staticData, path)){
        throw new Error('Model "' + modelName + '" not found');
    }
    return _.get(staticData, path);
};

/**
 * getCommandArgs
 *
 * @param {Object} paths
 * @param {Array|String} paths.orm
 * @param {Array|String} paths.odm
 *
 * return {Array}
 */
function getCommandArgs(paths) {

    return generate(paths.orm, 'orm-path')
        .concat(generate(paths.odm, 'odm-path'));

    function generate(paths, argName) {
        if (!paths) {
            return [];
        }

        if (!Array.isArray(paths)) {
            paths = [paths];
        }

        return paths.reduce(function(out, current) {
            out.push(`--${argName}`);
            out.push(current);
            return out;
        }, []);
    }
}
