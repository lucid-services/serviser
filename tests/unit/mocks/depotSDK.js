var sinon        = require('sinon');
var BIServiceSDK = require('bi-service-sdk').BIServiceSDK;

module.exports = DepotSDK;

function DepotSDK(opt) {
    BIServiceSDK.call(this, opt);

    this.version = 'v1.0';
}

DepotSDK.prototype = Object.create(BIServiceSDK.prototype);
DepotSDK.prototype.constructor = DepotSDK;


/**
 * @return {Promise}
 */
DepotSDK.prototype.getServiceClient = sinon.stub();
