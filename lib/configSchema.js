/**
 * Validation schema for service configuration
 */
module.exports = {
    type: 'object',
    additionalProperties: true,
    properties: {
        //whether to early exit a nodejs process when an error is encountered
        //in process of service initialization. Doesn't apply for errors which
        //happen after the service was successfully initialized
        exitOnInitError: { type: 'boolean' },
        //per App configuration indexed by app names
        apps: {
            type: 'object',
            additionalProperties: {
                type: 'object',
                properties: {
                    listen: {type: 'integer'},
                    //virtualhost
                    baseUrl: {type: 'string', format: 'uri'},
                    stopOnError: {type: 'boolean'},
                    // All app's routes will be setup to support defined Content-Type(s)
                    bodyParser: {
                        type: 'object',
                        additionalProperties: { //indexed by Content-type header value
                            type: 'object',
                            required: ['limit', 'extended'],
                            properties: {
                                limit: {type: 'string'},
                                extended: {type: 'boolean'}
                            }
                        }
                    },
                    doc: {type: 'object'}, //serviser-doc plugin per-app configuration
                    response: {
                        type: 'object',
                        properties: {
                            headers: {
                                type: 'array',
                                items: { //eg. ["X-Frame-Options", "deny"]
                                    type: 'array',
                                    maxItems: 2,
                                    minItems: 2,
                                    items: {
                                        type: 'string'
                                    }
                                }
                            }
                        }
                    },
                    request: {
                        type: 'object',
                        properties: {
                            timeout: {type: 'integer'}
                        }
                    }
                }
            }
        },
        storage: {
            type: 'object',
            properties: {
                memcached: {
                    type: 'object',
                    required: ['hosts'],
                    properties: {
                        hosts: {
                            type: 'array',
                            items: {type: 'string'}
                        },
                        timeout   : {type : 'integer'},
                        idle      : {type : 'integer'},
                        retries   : {type : 'integer'},
                        failures  : {type : 'integer'},
                        retry     : {type : 'integer'},
                        remove    : {type : 'integer'},
                        reconnect : {type : 'integer'},
                        failuresTimeout : {type : 'integer'},
                    }
                },
                couchbase: {
                    type: 'object',
                    required: ['host'],
                    properties: {
                        host: {type: 'string'},
                        buckets: {
                            type: 'object',
                            additionalProperties: {
                                type: 'object',
                                required: ['bucket'],
                                properties: {
                                    bucket: {type: 'string'}
                                }
                            }
                        }
                    }
                },
                postgres: {
                    type: 'object',
                    required: ['host'],
                    properties: {
                        host: {type: 'string'},
                        port: {type: 'integer'},
                        ssl: {type: 'boolean'},
                        databases: {
                            type: 'object',
                            additionalProperties: {
                                type: 'object',
                                required: ['db', 'username', 'password'],
                                properties: {
                                    db: {type: 'string'},
                                    username: {type: 'string'},
                                    password: {type: 'string'},
                                }
                            }
                        }
                    }
                },
                mysql: {
                    type: 'object',
                    required: ['host'],
                    properties: {
                        host: {type: 'string'},
                        port: {type: 'integer'},
                        ssl: {type: 'boolean'},
                        databases: {
                            type: 'object',
                            additionalProperties: {
                                type: 'object',
                                required: ['db', 'username', 'password'],
                                properties: {
                                    db: {type: 'string'},
                                    username: {type: 'string'},
                                    password: {type: 'string'},
                                }
                            }
                        }
                    }
                }
            }
        },
        //definition of other remote services used by the service.
        //integrates with the serviser-sdk plugin
        services: {
            type: 'object',
            additionalProperties: { // services
                type: 'object',
                additionalProperties: { //apps
                    type: 'object',
                    properties: {
                        protocol: {type: 'string', default: 'https'},
                        host: {type: 'string'},
                        npm: {type: 'string'},
                        dir: {type: 'string'},
                    }
                }
            }
        },
        logs: {
            type: 'object',
            properties: {
                // determines whether a process will exit with status code 1 on 'uncaughtException' event
                exitOnError: {type: 'boolean'},
                transports: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['type', 'priority'],
                        properties: {
                            type: {
                                type: 'string',
                                enum: ['fluentd', 'file', 'console']
                            },
                            priority: {type: 'integer'},
                            timeout: {type: 'integer'},
                            host: {type: 'string'},
                            port: {type: 'integer'},
                            dir: {type: 'string'},
                            autocreate: {type: 'boolean'},
                            reconnectionInterval: {type: 'integer'},
                        }
                    }
                }
            }
        }
    }
};
