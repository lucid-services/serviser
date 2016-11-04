var _            = require('lodash');
var Promise      = require('bluebird');
var childProcess = require('child_process');

var staticData;

/**
 * loadSync
 *
 * @param {Array|String} modelPaths
 *
 * @return {Object}
 */
module.exports.loadSync = function(modelPaths){

    var args = getCommandArgs(modelPaths);
    args.unshift(__dirname + '/loader.js');

    var result = childProcess.spawnSync('node', args);

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        var err = new Error('Static data loader exited with status code: ' + result.status);
        err.stderr = result.stderr;
        throw err;
    }


    try {
        staticData = JSON.parse(result.stdout.toString());
    } catch(e) {
        return reject(new Error('Expected application static data in valid JSON format: ' + e.message));
    }
    return staticData;
};

/**
 * load
 *
 * @param {Array} modelPaths
 *
 * @return {Promise<Object>}
 */
module.exports.load = function(modelPaths){
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
};

/**
 * get
 *
 * @param {String} modelName
 *
 * @return {mixed}
 */
module.exports.get = function(modelName) {
    modelName = _.upperFirst(_.camelCase(modelName));
    if(!staticData || !staticData.hasOwnProperty(modelName)){
        throw new Error('Model "' + modelName + '" not found');
    }
    return staticData[modelName];
};

/**
 * getCommandArgs
 *
 * @param {Array|String} paths
 *
 * return {Array}
 */
function getCommandArgs(paths) {
    if (paths && !Array.isArray(paths)) {
        paths = [paths];
    }

    return paths.reduce(function(out, current) {
        out.push('--path');
        out.push(current);
        return out;
    }, []);
}
