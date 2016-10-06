var util         = require('util');
var couchbaseODM = require('kouchbase-odm');
var Promise      = require('bluebird');

var Key       = couchbaseODM.Key;
var KeyError  = couchbaseODM.KeyError;
var DataTypes = couchbaseODM.DataTypes;

module.exports = RegExpKey;

function RegExpKey(options) {
    this.regexp = options.regexp;
    Key.call(this, options);
}
util.inherits(RegExpKey, Key);

RegExpKey.prototype.generate = function(instance) {
    var self = this;
    return new Promise(function(resolve){
        resolve(self);
    })
};

RegExpKey.setId = function(id) {
    if (id !== undefined) {
        if ((id + '').match(this.regexp) === null) {
            throw new KeyError('Failed to set `id`. The value is not in correct format:' + id);
        }
    }
    this.super.setId.call(this, id);
};

RegExpKey.dataType = DataTypes.STRING;

