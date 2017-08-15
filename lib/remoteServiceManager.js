var _ = require('lodash');

module.exports = RemoteServiceManager;
module.exports.RemoteServiceManager = RemoteServiceManager;


/**
 * manager of BIServiceSDK instances
 * 
 * @param {Object} services
 * @param {Object} services.$serviceName
 * @param {Object} services.$serviceName.$appName
 * @param {String} services.$serviceName.$appName.npm - npm package name which exports object that inherits BIServiceSDK
 * @param {String} services.$serviceName.$appName.host
 * @param {Boolean} services.$serviceName.$appName.ssl
 *
 * @constructor
 */
function RemoteServiceManager(services) {
    this.options = services || {};
    this.services = {};

    this.BIServiceSDK = require('bi-service-sdk').BIServiceSDK;
}


/**
 * @public
 * @param {String} key - format `$serviceName:$appName`
 * @param {BIServiceSDK} sdk
 *
 * @return {RemoteServiceManager} - self
 */
RemoteServiceManager.prototype.add = function(key, sdk) {
    var keySegments = key.split(':')
    ,   serviceName = keySegments[0]
    ,   appName     = keySegments[1];

    if (!(sdk instanceof this.BIServiceSDK)) {
        throw new Error('sdk must be instanceof BIServiceSDK');
    }

    if (keySegments.length !== 2) {
        throw new Error('The first argument must be in format: `$serviceName:$appName`');
    }

    if (!this.services[serviceName]) {
        this.services[serviceName] = {};
    }

    if (!this.services[serviceName][appName]) {
        this.services[serviceName][appName] = {};
    }

    this.services[serviceName][appName][sdk.version] = sdk;

    return this;
};


/**
 * @public
 * @param {String} key - format `$serviceName:$appName:$version`
 *
 * @return {BIServiceSDK}
 */
RemoteServiceManager.prototype.get = function(key) {
    var remoteService = _.get(this.services, key.split(':'));

    if (!remoteService) {
        throw new Error(`${key} remote service not found`);
    }

    return remoteService;
};


/**
 * constructs specific BIServiceSDK from service config
 *
 * @public
 *
 * @param {String} key - format: `$serviceName:$appName:$version`
 * @param {Object} [options] - sdk constructor options
 *
 * @throws {Error}
 * @return {BIServiceSDK}
 */
RemoteServiceManager.prototype.buildRemoteService = function(key, options) {
    var keySegments = key.split(':');
    var serviceName = keySegments[0];
    var appName     = keySegments[1];
    var version     = keySegments[2];

    if (keySegments.length !== 3) {
        throw new Error('The first argument must be in format: `$serviceName:$appName:$version`');
    }

    var confPath = `${serviceName}:${appName}`;
    var conf = _.get(this.options, [serviceName, appName]);

    if (!conf) {
        throw new Error(`Cant find config value of "${confPath}"`);
    }

    if (!_.isPlainObject(conf) || !conf.npm) {
        throw new Error(`"services:${confPath}:npm" config option not found. Cant connect remote service.`);
    }

    var sdkVersions = module.require(conf.npm);

    if (!sdkVersions.hasOwnProperty(version)) {
        throw new Error(`${confPath} service sdk does not have version: ${version}`);
    }

    var opt = _.cloneDeep(options || {});
    opt.baseURL = (conf.ssl ? 'https://' : 'http://') + conf.host;

    var sdk = new sdkVersions[version](opt);

    this.add(`${serviceName}:${appName}`, sdk);

    return sdk;
};
