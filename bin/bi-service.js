#!/usr/bin/env node

const argv    = process.argv.slice(2);
//TODO yargs API is too much cumbersome which causes some serious issues,
//consider migrating to eg.: commander.js in the next:major
const yargs   = require('yargs')(argv);
const path    = require('path');
const fs      = require('fs');
const logger  = require('bi-logger');//hooks up global uncaughtException listener
const _       = require('lodash');
const json5   = require('json5');
const config  = require('bi-config');
const Promise = require('bluebird');

const Service       = require('../index.js');
const utils         = require('../lib/utils.js');
const runCmd        = require('../lib/cli/runCmd.js');
const getConfigCmd  = require('../lib/cli/getConfigCmd.js');
const testConfigCmd = require('../lib/cli/testConfigCmd.js');

const VERSION       = require('../package.json').version;
const PROJECT_INDEX = path.resolve(process.cwd() + '/index.js');
const HELP_WIDTH    = Math.min(130, yargs.terminalWidth());

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


    const nativeCommands = [
        'init', 'run', 'get:config', 'test:config', '--version', 'init:seed',
        'init:schema', 'init:migration', 'init:mig', 'mig:status',
        'migration:status', 'migrate', 'seed', 'seed:all'
    ];

    //work around the yargs issue that makes it impossible to generate
    //--help output for commands & sub-commands
    //https://github.com/yargs/yargs/issues/1016
    //
    //as one of the known native commands has been matched, dispatch
    //the command and do NOT try to load additional user defined commands
    if (argv.length && nativeCommands.includes(argv[0])) {
        return _yargs.wrap(HELP_WIDTH).help().argv;
    }

    //no known registered cli command so far would be matched.
    //strict=false causes all unmatched commands to fallback to defaultCmd
    //function which tries to load user defined commands
    return _yargs.wrap(HELP_WIDTH).strict(false).argv;
}

module.exports.defaultCmd  = defaultCmd;

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
function defaultCmd(argv) {

    if (argv['get-conf'] !== undefined) {
        getConfigCmd(argv);
    //if no supported commands or options were matched so far,
    //we try to look for user defined shell commands:
    } else {
        config.initialize({fileConfigPath: argv.config});
        let ya = require('yargs/yargs')();

        ya.wrap(HELP_WIDTH);
        _initializeYargs(ya).help();

        if (fs.existsSync(PROJECT_INDEX)) {
            let service;
            const p = Promise.resolve();

            return p.then(function() {
                service = require(PROJECT_INDEX);
                service.appManager.on('build-app', _onBuildApp);
            }).then(function() {
                return service.$setup({
                    //inspect only resources with exclusive 'shell' tag
                    integrity: ['shell']
                });
            }).catch(function(err) {
                utils._stderr(
                    'Warning: Failure encountered (in user-space) while loading' +
                    ' additional shell commands.\n This is a problem' +
                    ' with service implementation, not with bi-service itself.\n'
                );
                p.cancel();

                return Promise.all([
                    Promise.fromCallback(function(cb) {
                        logger.error(err, cb);
                    }),
                    _setImmediate(_registerShellCommands, argv, ya, Service)
                ]);
            }).then(function() {
                return _setImmediate(_registerShellCommands, argv, ya, Service, service);
            }).catch(function(err) {
                utils._stderr(err);
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
