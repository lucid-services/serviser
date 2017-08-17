/**
 * Validation schema for bi-service config.json5
 */
module.exports = {
    $required: false,
    exitOnInitError: {$is: Boolean},
    proxy: {
        $forOwn: {
            $required: true,
            host: {$is: String},
            ssl: {$is: Boolean},
        }
    },
    listen: {
        $forOwn: {
            port: {
                $required: true,
                $isInt: null
            },
            type: {
                $required: true,
                $in: [
                    'public',
                    'private',
                    'private-websocket',
                    'public-websocket'
                ]
            },
            alias: { $is: String },
            proxy: {
                $forOwn: {
                    path: {$is: String},
                    url: {$isURL: null}
                }
            }
        }
    },
    apps: {
        $forOwn: {
            listen: { $isInt: null },
            baseUrl: {
                $required: true,
                $isURL: null
            },
            stopOnError: {
                $is: Boolean
            },
            bodyParser: {
                $forOwn: {
                    $required: true,
                    limit: {$is: String},
                    extended: {$is: Boolean}
                }
            },
            doc: {$is: Object},//inspected by bi-service-doc itself
            client: {
                id: {$is: String},
                secret: {$is: String},
            },
            response: {
                headers: {
                    $forEach: {
                        $required: true,
                        $hasLengthOf: {min:2, max: 2},
                        $forEach: {
                            $is: String
                        }
                    }
                }
            },
            request: {
                timeout: {$isInt: null}
            },
        }
    },
    storage: {
        memcached: {
            hosts   : {
                $required: true,
                $forEach: {$isURL: null}
            },
            timeout : {$isInt: null},
            idle    : {$isInt: null},
            retries : {$isInt: null},
            failures: {$isInt: null},
            retry   : {$isInt: null},
            remove  : {$is: Boolean},
            reconnect: {$isInt: null},
            failuresTimeout: {$isInt: null},
        },
        couchbase: {
            host: {
                $required: true,
                $is: String
            },
            buckets: {
                $required: true,
                $forOwn: {
                    bucket: {$is: String}
                }
            }
        },
        postgres: {
            host: {
                $required: true,
                $isURL: null
            },
            ssl: {
                $required: true,
                $is: Boolean
            },
            databases: {
                $is: Object,
                $forOwn: {
                    db: {
                        $required: true,
                        $is: String
                    },
                    username: {
                        $required: true,
                        $is: String
                    },
                    password: {
                        $required: true,
                        $is: String
                    },
                }
            }
        },
        mysql: {
            host: {
                $required: true,
                $isURL: null
            },
            ssl: {
                $required: false,
                $is: Boolean
            },
            databases: {
                $is: Object,
                $forOwn: {
                    db: {
                        $required: true,
                        $is: String
                    },
                    username: {
                        $required: true,
                        $is: String
                    },
                    password: {
                        $required: true,
                        $is: String
                    },
                }
            }
        }
    },
    services: {
        $forOwn: {
            $forOwn: {
                ssl: {$is: Boolean},
                host: {
                    $required: true,
                    $isURL: null
                },
                npm: {$is: String}
            }
        }
    },
    logs: {
        exitOnError: {$is: Boolean},
        transports: {
            $forEach: {
                type       : {
                    $required: true,
                    $in: ['fluentd', 'file', 'console']
                },
                priority   : {
                    $required: true,
                    $isInt : null
                },
                timeout    : {$isInt : null},
                host       : {$isURL : null},
                port       : {$isInt : null},
                dir        : {$is    : String},
                autocreate : {$is    : Boolean},
                reconnectionInterval : {$isInt : null},
            }
        }
    }
};
