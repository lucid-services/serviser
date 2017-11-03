/**
 * @typedef AppStatus
 * @type {Object}
 * @property {string} OK - application is successfully initialized and ready to receive connections
 * @property {string} INIT - application is being initialized
 * @property {string} ERROR - application failed during its initialization or after it started listening for connections
 */
module.exports = Object.freeze({
    OK: 'ok',
    INIT: 'init',
    ERROR: 'error'
});
