const _       = require('lodash');
const json5   = require('json5');
const config  = require('bi-config');

module.exports = getConfigCmd;

/**
 * @private
 * @param {Object} argv
 */
function getConfigCmd(argv) {
    if (!config.isInitialized()) {
        config.initialize({fileConfigPath: argv.config});
    }

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
