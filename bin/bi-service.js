#!/usr/bin/env node

const yargs   = require('yargs');
const cluster = require('cluster');
const path    = require('path');
const fs      = require('fs');
const logger  = require('bi-logger');//hooks up global uncaughtException listener
const _       = require('lodash');
const json5   = require('json5');
const config  = require('bi-config');
const Promise = require('bluebird');

const Service = require('../index.js');
const configSchema = require('../lib/configSchema.js');

const CPU_COUNT     = require('os').cpus().length;
const VERSION       = require('../package.json').version;
const PROJECT_INDEX = path.resolve(process.cwd() + '/index.js');

var _yargs = null; //yargs parser definition

// adds .json5 loader require.extension
require('json5/lib/require');

//run only if this module isn't required by other node module
if (module.parent === null) {

    _yargs = _initializeYargs(yargs);

    _yargs = _yargs.command('*', '', {
        'get-conf': {//TODO remove, deprecated (has been replated by get:config cmd)
            alias: 'g',
            describe: 'Prints resolved config value',
            type: 'string'
        },
        json5: {//TODO, remove deprecated (has been replated by get:config cmd)
            describe: 'if any json data are about to be printed they will be converted to json5 format',
            type: 'boolean',
            default: false
        },
        offset: {//TODO, remove , deprecated (has been replated by get:config cmd)
            describe: "A String or Number that's used to insert white space into the output JSON string for readability purposes.",
            default: 4
        }
    }, defaultCmd);

    _yargs.strict(false).wrap(yargs.terminalWidth()).argv;
}

module.exports.runCmd      = runCmd;
module.exports.defaultCmd  = defaultCmd;
module.exports._run        = _run;
module.exports._runCluster = _runCluster;
module.exports._verifyCWD  = _verifyCWD;

/**
 * @param {Object} ya - yargs
 */
function _initializeYargs(ya) {
    ya = ya
    .usage('$0 <command> [options]')
    .command(['run [options..]', 'start', 'serve'], 'Starts bi-service app - expects it to be located under cwd', {
        cluster: {
            alias: 'c',
            describe: '`<number>` is either a percentage amount (from number of available cpu threads) ' +
            'of childs/workers to be forked in the case of floating point value, or exlicit number of childs in the case of integer',
            default: 0,
            defaultDescription: 'cluster mode disabled',
            type: 'number'
        },
        'parse-pos-args': {
            describe: 'Whether to parse positional arguments',
            type: 'boolean',
            default: true
        }
    }, runCmd)
    .command(['get:config [key]'], 'Dumbs resolved service configuration', {
        json5: {
            describe: 'if any json data are about to be printed they will be converted to json5 format',
            type: 'boolean',
            default: false
        },
        offset: {
            describe: "A String or Number that's used to insert white space into the output JSON string for readability purposes.",
            default: 4
        }
    }, getConfigCmd)
    .command(['test:config'], 'Tries to load the configuration file. Validates configuration.', {
        schema: {
            describe: "File path of additional validation json-schema. Supported filetypes: json/js",
            type: 'string'
        }
    }, testConfigCmd)
    .option('help', {
        alias: 'h',
        describe: 'Show help',
        global: true,
        type: 'boolean'
    })
    .option('config', {
        describe: 'Custom config file destination',
        global: true,
        type: 'string'
    })
    .version('version', 'Prints bi-service version', VERSION);

    _loadExtension('bi-service-template', ya);
    _loadExtension('bi-db-migrations', ya);
    return ya;
}

/*
 * @param {String} name - npm package name
 * @param {Yargs} yargs
 */
function _loadExtension(name, yargs) {
    try{
        ya = require(name)(yargs);
    } catch(e) {
        if (e.code !== 'MODULE_NOT_FOUND') {
            throw e;
        }
    }
}

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
 * @private
 * @param {Object} argv
 */
function getConfigCmd(argv) {
    config.initialize({fileConfigPath: argv.config});
    var getOptionVal = argv.key || argv['get-conf'];
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
        process.stdout.write(val+'');
        process.stdout.write('\n');
        process.exit();
    } else {
        process.stderr.write(val+'');
        process.stderr.write('\n');
        process.exit(1);
    }
}

/**
 * @private
 * @param {Object} argv
 */
function testConfigCmd(argv) {
    let userSchema;

    try {
        if (argv.schema) {
            if (!path.isAbsolute(argv.schema)) {
                argv.schema = path.resolve(process.cwd() + '/' + argv.schema);
            }

            userSchema = require(argv.schema);
        }

        config.initialize({fileConfigPath: argv.config});
        config.setInspectionSchema(configSchema);

        if (!config.hasFileConfig) {
            throw new Error('No configuration file at: ' + config.$getDefaultConfigPath());
        }
    } catch(e) {
        process.stderr.write(e.message);
        process.stderr.write('\n');
        process.exit(1);
    }

    return config.inspectIntegrity().then(function() {
        if (!userSchema) {
            return null;
        }

        config.setInspectionSchema(userSchema);
        return config.inspectIntegrity();
    }).then(function() {
        process.stdout.write('OK');
        process.stdout.write('\n');
        process.exit(0);
    }).catch(function(e) {
        process.stderr.write(e.message);
        process.stderr.write('\n');
        process.exit(1);
    });
}

/**
 * @private
 * @param {Object} argv - shell arguments
 */
function defaultCmd(argv) {

    if (argv['get-conf'] !== undefined) {
        getConfigCmd(argv);
    //if no supported commands or options were matched so far,
    //we try to look for user defined shell commands:
    } else {
        config.initialize({fileConfigPath: argv.config});
        let ya = require('yargs/yargs')();

        ya.wrap(yargs.terminalWidth());
        _initializeYargs(ya).help();

        if (fs.existsSync(PROJECT_INDEX)) {
            let service = require(PROJECT_INDEX);
            service.appManager.on('build-app', _onBuildApp);

            return service.$setup({
                //inspect only resources with exclusive 'shell' tag
                integrity: ['shell']
            }).then(function() {
                return _setImmediate(_registerShellCommands, argv, ya, Service, service);
            }).catch(function(err) {
                if (err.toLogger instanceof Function) {
                    err = err.toLogger()
                } else if (err.toJSON instanceof Function) {
                    err = err.toJSON();
                }
                process.stderr.write(err);
                process.stderr.write('\n');
                process.exit(1);
            });
        } else {
            return _setImmediate(_registerShellCommands, argv, ya, Service);
        }
    }
}

/**
 * setImmediate which returns a Promise
 */
function _setImmediate(fn) {
    let args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function(resolve, reject) {
        setImmediate(function() {
            try {
                fn.apply(this, args);
            } catch(e) {
                return reject(e);
            }
            resolve();
        });
    });
}

/**
 * `build-app` AppManager listener
 * @private
 */
function _onBuildApp(app) {
    let proto = Object.getPrototypeOf(app);
    if (proto.constructor && proto.constructor.name === 'ShellApp') {
        app.once('post-init', function() {
            this.build();
            this.listen();
        });
    }
}

/**
 * @private
 * @param {Object} argv
 * @param {Yargs} yargs
 * @param {Function} Service - Service constructor
 * @param {Service} service - instance of Service
 */
function _registerShellCommands(argv, yargs, Service, service) {

    let args = process.argv.slice(2);

    Service.emit('shell-cmd', yargs);
    if (service) {
        service.emit('shell-cmd', yargs);
    }

    if (!args.length) {
        yargs.showHelp();
        process.exit(1);
    }
    yargs.parse(args);
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
        process.stderr.write(`Could not confirm that cwd is a bi-service project:`);
        process.stderr.write('\n');
        process.stderr.write(e);
        process.stderr.write('\n');
        process.exit(1);
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
            process.stderr.write(
                `${PROJECT_INDEX} does not export a Service object`
            );
            process.stderr.write('\n');
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
        process.stderr.write(
            'Invalid `cluster` option value.' +
            ' Expecting an integer or float n where n > 0'
        );
        process.stderr.write('\n');
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
            process.stderr.write('disconnect!');
            process.stderr.write('\n');
        });
    } else {
        _run();
    }
}
