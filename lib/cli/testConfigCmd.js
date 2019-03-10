const path    = require('path');
const config  = require('serviser-config');

const configSchema = require('../configSchema.js');
const utils        = require('../utils.js');

module.exports = testConfigCmd;

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

        if (!config.isInitialized()) {
            config.initialize({fileConfigPath: argv.config});
        }
        config.setInspectionSchema(configSchema);

        if (!config.hasFileConfig) {
            throw new Error('No configuration file at: ' + config.$getDefaultConfigPath());
        }
    } catch(e) {
        utils._stderr(e)
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
        utils._stderr(e);
        process.exit(1);
    });
}

