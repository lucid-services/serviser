'use strict';

var util = require('util');

module.exports = function (couchbaseCluster, odm) {

    var DataTypes = odm.CouchbaseODM.DataTypes
    var RegExpKey = require('../../couchbaseODM/regExpKey');

    var Model = odm.define(
        'client', {
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
                redirectUrls: {
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
