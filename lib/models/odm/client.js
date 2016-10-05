'use strict';

var couchbaseODM = require('kouchbase-odm');
var util         = require('util');
var RegExpKey    = require('../../couchbaseODM/regExpKey');

var Key = couchbaseODM.Key
var DataTypes = couchbaseODM.DataTypes

module.exports = function (couchbaseCluster, odm) {

    var Model = odm.define(
        'Client', {
            type: DataTypes.HASH_TABLE,
            schema: {
                name: {
                    type: DataTypes.STRING,
                    required: true,
                },
                active: {
                    type: DataTypes.BOOLEAN,
                    default: true
                },
                clientSecret: {
                    type: DataTypes.STRING,
                    required: true,
                },
                scopes: {
                    type: DataTypes.ARRAY,
                    default: []
                },
                domains: {
                    type: DataTypes.ARRAY,
                    default: []
                },
                ips: {
                    type: DataTypes.ARRAY,
                    default: []
                },
                apps: {
                    type: DataTypes.ARRAY,
                    default: []
                },
            },
        },
        {
            indexes: {
                refDocs: {
                    getByName: { keys: [ 'name' ] }
                }
            },
            key: RegExpKey,
            schemaSettings: {
                key: {
                    regexp: /.{29,}/i
                }
            }
        }
    );

    return Model;
};
