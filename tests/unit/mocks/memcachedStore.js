var sinon = require('sinon');
var EventEmitter = require('events').EventEmitter;

module.exports = MemcachedStore;

function MemcachedStore() {
    EventEmitter.call(this);

    this.client = {
        get: sinon.stub(),
        destroy: sinon.stub(),
        set: sinon.stub()
    };
}

MemcachedStore.prototype = Object.create(EventEmitter.prototype);
MemcachedStore.prototype.constructor = MemcachedStore;
