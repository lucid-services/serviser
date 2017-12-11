var sinon = require('sinon');
var BIServiceSDK = require('bi-service-sdk').BIServiceSDK;

module.exports = SDK;

function SDK(options) {
    BIServiceSDK.call(this, options);

    this.version = 'v1.0';
}

SDK.prototype = Object.create(BIServiceSDK.prototype);
SDK.prototype.constructor = SDK;
