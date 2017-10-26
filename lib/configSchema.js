/**
 * Validation schema for bi-service config.json5
 */
module.exports = {
    type: 'object',
    additionalProperties: true,
    properties: {
        //whether to early exit a nodejs process when an error is encountered
        //in process of service initialization. Doesn't apply for errors which
        //happen after the service was successfully initialized
        exitOnInitError: { type: 'boolean' },
        proxy: {
            type: 'object',
            additionalProperties: {
                type: 'object',
                required: ['host', 'protocol', 'ssl'],
                properties: {
                    host: { type: 'string' },
                    protocol: { type: 'string' },
                    ssl: { type: 'boolean' },
                }
            }
        },
        //app port definition & deomain aliases
        listen: {
            type: 'object',
            additionalProperties: {
                type: 'object',
                additionalProperties: true,
                required: ['port', 'type'],
                properties: {
                    port: {type: 'integer'},
                    type: {
                        type: 'string',
                        enum: [
                            'public',
                            'private',
                            'private-websocket',
                            'public-websocket'
                        ]
                    },
                    alias: {type: 'string'},
                    proxy: {
                        additionalProperties: {
                            type: 'object',
                            properties: {
                                path: {type: 'string'},
                                url: {type: 'string'}
                            }
                        }
                    }
                }
            }
        },
        //per App configuration indexed by app names
        apps: {
            type: 'object',
            additionalProperties: {
                type: 'object',
                properties: {
                    listen: {type: 'integer'},
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
                    doc: {type: 'object'}, //bi-service-doc plugin per-app configuration
                    client: {
                        type: 'object',
                        required: ['id'],
                        properties: {
                            id: {type: 'string'},
                            secret: {type: 'string'}
                        }
                    },
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
        //integrates with the bi-service-sdk plugin
        services: {
            type: 'object',
            additionalProperties: { // services
                type: 'object',
                additionalProperties: { //apps
                    type: 'object',
                    properties: {
                        ssl: {type: 'boolean'},
                        host: {type: 'string', format: 'uri'},
                        npm: {type: 'string'},
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
