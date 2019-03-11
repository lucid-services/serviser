var sinon = require('sinon');
var ServiceSDK = require('serviser-sdk').ServiceSDK;

module.exports = SDK;

function SDK(options) {
    ServiceSDK.call(this, options);

    this.version = 'v1.0';
}

SDK.prototype = Object.create(ServiceSDK.prototype);
SDK.prototype.constructor = SDK;
