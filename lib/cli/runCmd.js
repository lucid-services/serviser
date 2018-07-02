const cluster = require('cluster');
const path    = require('path');
const fs      = require('fs');
const config  = require('bi-config');
const _       = require('lodash');
const json5   = require('json5');


const Service = require('../../index.js');
const utils   = require('../utils.js');

const CPU_COUNT     = require('os').cpus().length;
const PROJECT_INDEX = path.resolve(process.cwd() + '/index.js');

module.exports             = runCmd;
module.exports.runCmd      = runCmd;
module.exports._run        = _run;
module.exports._runCluster = _runCluster;
module.exports._verifyCWD  = _verifyCWD;

/**
 * @private
 * @param {Object} argv - shell arguments
 */
function runCmd(argv) {
    var confOpt = _parseShellConfigOptions(argv);
    config.initialize(confOpt);

    //when argv.cluster === void 0, the user provided --cluster
    //flag without the option value (number of childs/nodes)
    if (argv.cluster || argv.cluster === void 0) {
        _runCluster(argv.cluster);
    } else {
        _run();
    }
}

/**
 * searches for custom bin/www startup script if not found, it starts up
 * the service itself.
 * @private
 * @return {undefined}
 */
function _run() {
    _verifyCWD();

    var customStartupFilePath = path.resolve(process.cwd() + '/bin/www');

    if (fs.existsSync(customStartupFilePath)) {
        require(customStartupFilePath);
    } else if (fs.existsSync(PROJECT_INDEX)) {
        let service = require(PROJECT_INDEX);
        if (!(service instanceof Service)) {
            utils._stderr(`${PROJECT_INDEX} does not export a Service object`);
            process.exit(1);
        }

        service.listen();
    }
}


/**
 * @private
 * @return {undefined}
 */
function _runCluster(numOfWorkers) {

    if (typeof numOfWorkers !== 'number') {
        numOfWorkers = CPU_COUNT;
    } else if (numOfWorkers <= 0
        || (!Number.isInteger(numOfWorkers)
            && numOfWorkers < 0
        )
    ) {
        utils._stderr(
            'Invalid `cluster` option value.' +
            ' Expecting an integer or float n where n > 0'
        );
        process.exit(1);
    } else if (!Number.isInteger(numOfWorkers)) {
        numOfWorkers = Math.round(numOfWorkers * CPU_COUNT);
    }

    if (cluster.isMaster) {
        _verifyCWD();
        // Create a worker for each CPU
        for (let i = 0; i < numOfWorkers; i += 1) {
            cluster.fork();
        }
        // Listen for dying workers
        cluster.on('exit', function () {
            setTimeout(function() {
                cluster.fork();
            }, 5000);
        });
        //
        cluster.on('disconnect', function(worker) {
            utils._stderr('disconnect!');
        });
    } else {
        _run();
    }
}

/**
 *
 */
function _verifyCWD() {

    packagePath = process.cwd() + '/package.json';

    try {
        require(packagePath);
    } catch(e) {
        if (e.code !== 'MODULE_NOT_FOUND') {
            throw e;
        }
        utils._stderr(`Could not confirm that cwd is a bi-service project:`);
        utils._stderr(e);
        process.exit(1);
    }
}

/**
 * returns parsed object with positional shell arguments.
 * These options will then overwrite option values set in configuration file
 * @private
 * @param {Object} argv - shell arguments
 * @return {Object}
 */
function _parseShellConfigOptions(argv) {
    var out = {};

    //`parse-pos-args` value is `true` by default, it must be
    //explicitly set to falsy value thus undefined & null values does not count
    if (argv['parse-pos-args'] === false || argv['parse-pos-args'] === 0) {
        setConfigPathOption(out);
        return out;
    }

    var options = argv.options.reduce(function(out, option, index) {
        if (index % 2 === 0) {
            out.names.push(option);
        } else {
            out.values.push(option);
        }
        return out;
    }, {
        names: [],
        values: []
    });

    if (argv.options.length % 2 !== 0) {
        throw new Error(
            `Invalid number of shell positional arguments received.
            Possitional arguments are expected to be in "[key] [value]" pairs`
        );
    }

    options.names.forEach(function(propPath, index) {
        _.set(
            out,
            propPath,
            json5.parse(options.values[index])
        );
    });

    setConfigPathOption(out);

    return out;

    function setConfigPathOption(obj) {
        //for overwriting expected config filepath we can use --config option only
        if (argv.config) {
            obj.fileConfigPath = argv.config;
            obj.fileConfigPath = path.normalize(obj.fileConfigPath);
        } else {
            delete obj.fileConfigPath;
        }
    }
}
