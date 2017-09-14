#!/usr/bin/env node

const yargs   = require('yargs');
const cluster = require('cluster');
const path    = require('path');
const fs      = require('fs');
const logger  = require('bi-logger');
const _       = require('lodash');
const json5   = require('json5');
const config  = require('bi-config');

const Service = require('../index.js');

const CPU_COUNT = require('os').cpus().length;
const VERSION   = require('../package.json').version;
var _yargs = null; //yargs parser definition

// adds .json5 loader require.extension
require('json5/lib/require');

//run only if this module isn't required by other node module
if (module.parent === null) {

    _yargs = yargs
    .usage('$0 <command> [options]')
    .command('*', '', {
        'get-conf': {
            alias: 'g',
            describe: 'Prints resolved config value',
            type: 'string'
        },
        json5: {
            describe: 'if any json data are about to be printed they will be converted to json5 format',
            type: 'boolean',
            default: false
        },
        offset: {
            describe: "A String or Number that's used to insert white space into the output JSON string for readability purposes.",
            default: 4
        }
    }, defaultCmd)
    .command(['run [options..]', 'start', 'serve'], 'Starts bi-service app - expects it to be located under cwd', {
        cluster: {
            alias: 'c',
            describe: 'runs bi-service app in cluster mode - spawns child workers which are connected to the master process via IPC channel',
            default: false,
            type: 'boolean'
        },
        'parse-pos-args': {
            describe: 'Whether to parse positional arguments',
            type: 'boolean',
            default: true
        }
    }, runCmd)
    .option('config', {
        describe: 'Custom config file destination',
        global: true,
        type: 'string'
    })
    .version('version', 'Prints bi-service version', VERSION);

    try{
        _yargs = require('bi-service-template')(_yargs);
    } catch(e) {
        if (e.code !== 'MODULE_NOT_FOUND') {
            throw e;
        }
    }

    try{
        _yargs = require('bi-service-sequelize-migrations')(_yargs);
    } catch(e) {
        if (e.code !== 'MODULE_NOT_FOUND') {
            throw e;
        }
    }

    const argv = _yargs
        .help('h', false)
        .alias('h', 'help')
        .wrap(yargs.terminalWidth())
        .argv;
}

module.exports.runCmd        = runCmd;
module.exports.defaultCmd    = defaultCmd;
module.exports._run          = _run;
module.exports._runCluster   = _runCluster;
module.exports._verifyCWD    = _verifyCWD;

/**
 * @param {Object} argv - shell arguments
 */
function runCmd(argv) {
    var confOpt = _parseShellConfigOptions(argv);
    config.initialize(confOpt);

    if (argv.cluster) {
        _runCluster();
    } else {
        _run();
    }
}

/**
 * @param {Object} argv - shell arguments
 */
function defaultCmd(argv) {
    if (argv['get-conf'] !== undefined) {
        config.initialize({fileConfigPath: argv.config});
        var getOptionVal = argv['get-conf'];
        var val;
        if (!getOptionVal) {
            val = config.get();
        } else {
            val = _.get(config.get(), getOptionVal);
        }

        if (val !== undefined) {
            if (typeof val === 'object') {
                var jsonUtils = argv.json5 ? json5 : JSON;

                val = jsonUtils.stringify(val, null, argv.offset);
            }
            console.log(val);
            process.exit();
        } else {
            console.error(val);
            process.exit(1);
        }
    } else {
        _yargs.showHelp();
        process.exit(1);
    }
}

/**
 * returns parsed object with positional shell arguments.
 * These options will then overwrite option values set in configuration file
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
        console.error(`Could not confirm that cwd is a bi-service project:`);
        console.error(e);
        process.exit(1);
    }
}

/**
 * searches for custom bin/www startup script if not found, it starts up
 * the service itself.
 * @return {undefined}
 */
function _run() {
    _verifyCWD();

    var customStartupFilePath = path.resolve(process.cwd() + '/bin/www');
    var projectIndex = path.resolve(process.cwd() + '/index.js');

    if (fs.existsSync(customStartupFilePath)) {
        require(customStartupFilePath);
    } else if (fs.existsSync(projectIndex)) {
        let service = require(projectIndex);
        if (!(service instanceof Service)) {
            console.error(`${projectIndex} does not export a Service object`);
            process.exit(1);
        }

        service.listen();
    }
}

/**
 * @return {undefined}
 */
function _runCluster() {
    if (cluster.isMaster) {
        _verifyCWD();
        // Create a worker for each CPU
        for (let i = 0; i < CPU_COUNT; i += 1) {
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
            console.error('disconnect!');
        });
    } else {
        _run();
    }
}
