const sinon     = require('sinon');
const chai      = require('chai');
const sinonChai = require("sinon-chai");
const Validator = require('ajv');

const utils = require('../../../lib/utils');

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

describe('registerCustomKeywords', function() {
    beforeEach(function() {
        this.validator = new Validator({});
    });

    describe('$desc', function() {
        it('should register custom $desc keyword', function() {
            utils.registerCustomKeywords(this.validator);

            this.validator.validateSchema({
                type: "object",
                properties: {
                    username: {
                        type: 'string',
                        $desc: 'field description'
                    }
                }
            }).should.be.equal(true);
        });
    });

    describe('$toJSON', function() {
        it('should register custom $toJSON keyword', function() {
            utils.registerCustomKeywords(this.validator);

            this.validator.validateSchema({
                type: 'object',
                properties: {
                    user: {
                        allOf: [
                            {$toJSON: {}},
                            { type: 'object' }
                        ]
                    }
                }
            }).should.be.equal(true);
        });

        it('should parse json string', function() {
            utils.registerCustomKeywords(this.validator);

            const schema = {
                type: 'object',
                properties: {
                    json: {
                        allOf: [
                            {$toJSON: {}},
                            { type: 'object' }
                        ]
                    }
                }
            };
            const data = {json: '{"prop": "value"}'};

            this.validator.validate(schema, data).should.be.equal(true);
            data.json.should.be.eql({prop: 'value'});
        });

        it('should convert data object to json by calling its toJSON method implementation', function() {
            utils.registerCustomKeywords(this.validator);

            const schema = {
                type: 'object',
                properties: {
                    json: {
                        allOf: [
                            {$toJSON: {}},
                            {
                                type: 'object',
                                required: ['prop'],
                                properties: {
                                    prop: {type: 'string'}
                                }
                            }
                        ]
                    }
                }
            };

            function Data() {}

            Data.prototype.toJSON = function toJSON() {
                return {prop: 'value'};
            };

            const data = {json: new Data};

            this.validator.validate(schema, data).should.be.equal(true);
            data.json.should.be.eql({prop: 'value'});
        });
    });
});
