const sinon     = require('sinon');
const chai      = require('chai');
const sinonChai = require("sinon-chai");
const Validator = require('ajv');

const utils = require('../../lib/utils');

const expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('resolveSchemaRefs', function() {
    beforeEach(function() {
        this.validator = new Validator({});
    });

    afterEach(function() {
        delete this.validator;
    });

    it('should dereference all `$ref` schema references', function() {
        this.validator.addSchema({type: 'integer'}, 'id');
        this.validator.addSchema({type: 'string'}, 'name');
        this.validator.addSchema({type: 'string'}, 'code_2');
        this.validator.addSchema({
            type: 'object',
            properties: {
                id: {$ref: 'id'}
            }
        }, 'app');

        let schema = {
            type: 'object',
            properties: {
                code_3: {type: 'string'},
                name: {$ref: 'name'},
                country: {
                    type: 'object',
                    properties: {
                        code_2: {$ref: 'code_2'},
                        code_3: {$ref: '#/properties/code_3'}
                    }
                },
                apps: {
                    type: 'array',
                    items: {$ref: 'app'}
                }
            }
        };

        let result = utils.resolveSchemaRefs(schema, this.validator);
        result.should.be.eql({
            type: 'object',
            properties: {
                code_3: {type: 'string'},
                name: {type: 'string'},
                country: {
                    type: 'object',
                    properties: {
                        code_2: {type: 'string'},
                        code_3: {type: 'string'}
                    }
                },
                apps: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: {type: 'integer'}
                        }
                    }
                }
            }
        });
    });

    it('should dereference all `$ref` schema references (2)', function() {
        this.validator.addSchema({type: 'integer'}, 'id');
        this.validator.addSchema({type: 'string'}, 'name');

        let schema = {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: {$ref: 'id'},
                    name: {$ref: 'name'},
                }
            }
        };

        let result = utils.resolveSchemaRefs(schema, this.validator);
        result.should.be.eql({
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: {type: 'string'},
                    id: {type: 'integer'},
                }
            }
        });
    });
});
