var _         = require('lodash');
var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");

var objectFilter = require('../../lib/objectFilter.js');
var assertions = objectFilter.assertions;

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('objectFilter', function() {
    describe('assertions', function() {
        describe('gt', function() {
            it('should return true if and only if provided number value is grater than a number value passed as filter', function() {
                var valid = [
                    {val: 0, filter: -1},
                    {val: 4, filter: 0}
                ];
                var invalid = [
                    {val: 0},
                    {val: 2, filter: 4},
                    {val: 2, filter: null},
                    {val: null, filter: 2},
                    {},
                    {val: undefined, filter: 4},
                    {val: 4, filter: undefined},
                ];

                valid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$gt.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$gt.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });

        });

        describe('gte', function() {
            it('should return true if and only if provided number value is grater than or equal to a number value passed as filter', function() {
                var valid = [
                    {val: 0, filter: -1},
                    {val: 4, filter: 0},
                    {val: 0, filter: 0},
                ];
                var invalid = [
                    {val: 0},
                    {val: 2, filter: 4},
                    {val: 2, filter: null},
                    {val: null, filter: 2},
                    {},
                    {val: undefined, filter: 4},
                    {val: 4, filter: undefined}
                ];

                valid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$gte.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$gte.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('lt', function() {
            it('should return true if and only if provided number value is lower than a number value passed as filter', function() {
                var valid = [
                    {val: -1, filter: 0},
                    {val: 0, filter: 4}
                ];
                var invalid = [
                    {val: 0},
                    {val: 4, filter: 2},
                    {val: null, filter: 2},
                    {val: 2, filter: null},
                    {},
                    {val: undefined, filter: 4},
                    {val: 4, filter: undefined}
                ];

                valid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$lt.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$lt.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('lte', function() {
            it('should return true if and only if provided number value is lower than or equal to a number value passed as filter', function() {
                var valid = [
                    {val: -1, filter: 0},
                    {val: 0, filter: 4},
                    {val: 4, filter: 4}
                ];
                var invalid = [
                    {val: 0},
                    {val: 4, filter: 2},
                    {val: null, filter: 2},
                    {val: 2, filter: null},
                    {},
                    {val: undefined, filter: 4},
                    {val: 4, filter: undefined}
                ];

                valid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$lte.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$lte.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('eq', function() {
            it('should return true if and only if provided number value is equal to a number value passed as filter', function() {
                var valid = [
                    {val: 4, filter: 4},
                    {val: '', filter: ''},
                    {val: undefined, filter: undefined},
                    {val: undefined, filter: null}, //undefined == null
                    {},
                    {val: null, filter: null}
                ];
                var invalid = [
                    {val: 0},
                    {val: 4, filter: 2},
                    {val: 4, filter: 5},
                    {val: null, filter: 2},
                    {val: 2, filter: null},
                    {val: {}, filter: {}},
                    {val: undefined, filter: 4},
                    {val: 4, filter: undefined}
                ];

                valid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$eq.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$eq.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('ne', function() {
            it('should return true if and only if provided number value is not equal to a number value passed as filter', function() {
                var valid = [
                    {val: -1, filter: 0},
                    {val: 0, filter: 4},
                    {val: null, filter: 2},
                    {val: 2, filter: null},
                    {val: undefined, filter: 4},
                    {val: 4, filter: undefined},
                    {val: 0},
                ];
                var invalid = [
                    {val: 2, filter: 2},
                    {},
                    {val: undefined, filter: undefined},
                    {val: null, filter: null}
                ];

                valid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$ne.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$ne.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('between', function() {
            it('should return true if and only if a validated value is a number between range of two defined numbers (including the defined numbers)', function() {
                var valid = [
                    {val: 1, filter: [-1, 2]},
                    {val: '1', filter: ['-1', '2']},
                    {val: '0.1', filter: ['-1', '2']},
                    {val: '1', filter: [1, 1]},
                ];
                var invalid = [
                    {val: '1', filter: [-4, -1]},
                    {val: 0},
                    {val: 2, filter: null},
                    {val: 4, filter: undefined},
                    {},
                    {val: undefined, filter: undefined},
                    {val: null, filter: null}
                ];

                valid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$between.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$between.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('notBetween', function() {
            it('should return true if and only if a validated value is a number NOT between range of two defined numbers (including the defined numbers)', function() {
                var valid = [
                    {val: 3, filter: [-1, 2]},
                    {val: '-2', filter: ['-1', '2']},
                    {val: '0.1', filter: ['0.3', '0.5']},
                    {val: '2', filter: [1, 1]},
                ];
                var invalid = [
                    {val: '0', filter: [-4, 1]},
                    {val: 0},
                    {val: 2, filter: null},
                    {val: 4, filter: undefined},
                    {},
                    {val: undefined, filter: undefined},
                    {val: null, filter: null}
                ];

                valid.forEach(function(testVal, index) {
                    testVal.assertions  = assertions;
                    var resolvedContext = assertions.$notBetween.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    testVal.assertions  = assertions;
                    var resolvedContext = assertions.$notBetween.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('like', function() {
            it('should behave like sql `LIKE` operator (case sensitive)', function() {
                var valid = [
                    {val: 'abcdefgh', filter: '%cdef%'},
                    {val: 'abcdefgh', filter: 'abc%'},
                    {val: 'abcdefgh', filter: '%efgh'},
                ];

                var invalid = [
                    {val: 'abcdefgh', filter: '%cDef%'},
                    {val: 'abcdefgh', filter: undefined},
                    {val: null, filter: '%cZef%'},
                    {val: 'abcdefgh', filter: '%cZef%'},
                    {val: 'abcdefgh', filter: '%cdef'},
                    {val: 'yzabefgh', filter: '%cdef%'},
                ];

                valid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$like.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$like.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });

            it('should accept an object with `$any` collection of filters in place of `filter`', function() {
                var valid = [
                    {val: 'abcdefgh', filter: {$any: ['%yz%', 'abc%']}},
                    {val: 'abcdefgh', filter: {$any: ['cdef%', '%gh']}},
                    {val: 'abcd', filter: {$any: ['%abcd%']}},
                ];

                var invalid = [
                    {val: 'abcdefgh', filter: {$any: ['cdef%', 'test']}},
                ];

                valid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$like.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    var resolvedContext = assertions.$like.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('notLike', function() {
            it('should bahave like negated sql `LIKE` operator (case sensitive)', function() {
                var valid = [
                    {val: 'abcdefgh', filter: '%cDef%'},
                    {val: 'abcdefgh', filter: '%cZef%'},
                    {val: 'yzabefgh', filter: '%cdef%'},
                ];

                var invalid = [
                    {val: 'abcdefgh', filter: '%cdef%'},
                    {val: 'abcdefgh', filter: 'abc%'},
                    {val: 'abcdefgh', filter: '%efgh'},
                ];

                valid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$notLike.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$notLike.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });

            it('should accept an object with `$any` collection of filters in place of `filter`', function() {
                var valid = [
                    {val: 'abcdefgh', filter: {$any: ['cdef%', 'test']}},
                ];

                var invalid = [
                    {val: 'abcdefgh', filter: {$any: ['%yz%', 'abc%']}},
                    {val: 'abcdefgh', filter: null},
                    {val: undefined, filter: {$any: ['cdef%', 'test']}},
                    {val: 'abcdefgh', filter: {$any: ['cdef%', '%gh']}},
                    {val: 'abcd', filter: {$any: ['%abcd%']}},
                ];

                valid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$notLike.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$notLike.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('iLike', function() {
            it('should behave like sql `LIKE` operator (case INsensetive)', function() {
                var valid = [
                    {val: 'abcdefgh', filter: '%CDEF%'},
                    {val: 'abCdEFgh', filter: 'abC%'},
                    {val: 'abcdefgh', filter: '%efgh'},
                ];

                var invalid = [
                    {val: 'abcdefgh', filter: null},
                    {val: undefined, filter: '%cZeF%'},
                    {val: 'abcdefgh', filter: '%cZeF%'},
                    {val: 'yzAbEfGh', filter: '%CdEf%'},
                ];

                valid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$iLike.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$iLike.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });

            it('should accept an object with `$any` collection of filters in place of `filter`', function() {
                var valid = [
                    {val: 'abCdeFgh', filter: {$any: ['%YZ%', 'ABC%']}},
                    {val: 'aBcdEfgh', filter: {$any: ['cDef%', '%gH']}},
                    {val: 'abcD', filter: {$any: ['%aBCd%']}},
                ];

                var invalid = [
                    {val: 'abcdEfgH', filter: {$any: ['cDeF%', 'tEst']}},
                ];

                valid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$iLike.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$iLike.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('notILike', function() {
            it('should bahave like negated sql `LIKE` operator (case INsensitive)', function() {
                var valid = [
                    {val: 'abcdefgh', filter: '%cZeF%'},
                    {val: 'yzAbEfGh', filter: '%CdEf%'},
                ];

                var invalid = [
                    {val: 'abcdefgh', filter: null},
                    {val: undefined, filter: '%CDEF%'},
                    {val: 'abcdefgh', filter: '%CDEF%'},
                    {val: 'abCdEFgh', filter: 'abC%'},
                    {val: 'abcdefgh', filter: '%efgh'},
                ];

                valid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$notILike.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$notILike.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });

            it('should accept an object with `$any` collection of filters in place of `filter`', function() {
                var valid = [
                    {val: 'abcdEfgH', filter: {$any: ['cDeF%', 'tEst']}},
                ];

                var invalid = [
                    {val: 'abCdeFgh', filter: null},
                    {val: 'abCdeFgh', filter: {$any: ['%YZ%', 'ABC%']}},
                    {val: 'aBcdEfgh', filter: {$any: ['cDef%', '%gH']}},
                    {val: 'abcD', filter: {$any: ['%aBCd%']}},
                ];

                valid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$notILike.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$notILike.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('in', function() {
            it('should return true if exact validated value is present in given arrray', function() {
                var valid = [
                    {val: 'test', filter: ['test', 'adfsd', 'dsafasjk']},
                ];

                var invalid = [
                    {val: 1, filter: ['1', 'test', '']},
                    {val: 0, filter: ['1', 'test', '']},
                    {val: undefined, filter: ['1', 'test', '']},
                    {val: null, filter: ['1', 'test', '']},
                    {val: false, filter: ['1', 'test', '']}
                ];

                valid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$in.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$in.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('any', function() {
            it('should return true if exact validated value is present in given arrray', function() {
                var valid = [
                    {val: 'test', filter: ['test', 'adfsd', 'dsafasjk']},
                ];

                var invalid = [
                    {val: 1, filter: ['1', 'test', '']},
                    {val: 0, filter: ['1', 'test', '']},
                    {val: undefined, filter: ['1', 'test', '']},
                    {val: null, filter: ['1', 'test', '']},
                    {val: false, filter: ['1', 'test', '']}
                ];

                valid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$any.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$any.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });
            });
        });

        describe('notIn', function() {
            it('should return true if validated value is NOT present in given array', function() {
                var valid = [
                    {val: 1, filter: ['1', 'test', '']},
                    {val: 0, filter: ['1', 'test', '']},
                    {val: undefined, filter: ['1', 'test', '']},
                    {val: null, filter: ['1', 'test', '']},
                    {val: false, filter: ['1', 'test', '']}
                ];

                var invalid = [
                    {val: 'test', filter: ['test', 'adfsd', 'dsafasjk']},
                ];

                valid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$notIn.call(testVal);
                    resolvedContext.should.be.equal(true, 'Data set: ' + index);
                });

                invalid.forEach(function(testVal, index) {
                    testVal.assertions = assertions;
                    var resolvedContext = assertions.$notIn.call(testVal);
                    resolvedContext.should.be.equal(false, 'Data set: ' + index);
                });

            });
        });
    });

    describe('conditions', function() {

        describe('and', function() {
            it('should call each assertion', function() {
                var assertions = [
                    sinon.stub().returns(true),
                    sinon.stub().returns(true),
                    sinon.stub().returns(true),
                ];

                var condition = objectFilter.buildCondition(assertions, '$and');

                condition();

                assertions.forEach(function(assertion) {
                    assertion.should.be.calledOnce;
                });
            });

            it("should return true", function() {
                var assertions = [
                    sinon.stub().returns(true),
                    sinon.stub().returns(true),
                    sinon.stub().returns(true),
                ];

                var condition = objectFilter.buildCondition(assertions, '$and');

                condition().should.be.equal(true);
            });

            it('should return false', function() {
                var assertions = [
                    sinon.stub().returns(true),
                    sinon.stub().returns(false),
                    sinon.stub().returns(true),
                ];

                var condition = objectFilter.buildCondition(assertions, '$and');

                condition().should.be.equal(false);
            });
        });

        describe('or', function() {
            it('should call each assertion', function() {
                var assertions = [
                    sinon.stub().returns(false),
                    sinon.stub().returns(false),
                    sinon.stub().returns(true),
                ];

                var condition = objectFilter.buildCondition(assertions, '$or');

                condition();

                assertions.forEach(function(assertion) {
                    assertion.should.be.calledOnce;
                });
            });

            it("should return true", function() {
                var assertions = [
                    sinon.stub().returns(false),
                    sinon.stub().returns(true),
                    sinon.stub().returns(false),
                ];

                var condition = objectFilter.buildCondition(assertions, '$or');

                condition().should.be.equal(true);
            });

            it('should return false', function() {
                var assertions = [
                    sinon.stub().returns(false),
                    sinon.stub().returns(false),
                    sinon.stub().returns(false),
                ];

                var condition = objectFilter.buildCondition(assertions, '$or');

                condition().should.be.equal(false);
            });
        });
    });

    describe('filterData', function() {
        before(function() {
            this.data = [
                {
                    name: 'John Snow',
                    street: 'Nad Pomnikem',
                    apps: ['Arma 3', 'Arma 2', 'Ylands'],
                    country: {
                        code_2: 'US'
                    }
                },
                {
                    name: 'Undefined Undefined',
                    street: 'Stepanska',
                    apps: ['Arma 3', 'Ylands'],
                    country: {
                        code_2: 'CZ'
                    }
                },
                {
                    name: 'Ivan Strahowski',
                    street: 'Plzenska',
                    apps: ['Ylands'],
                    country: {
                        code_2: 'RU'
                    }
                },
            ];
        });

        it('should return correctly filterred data (case 1)', function() {

            var filtered = objectFilter.filterData(this.data, {
                name: 'John Snow'
            }, {dataProperty: null})

            filtered.should.include(this.data[0]);
            filtered.should.have.lengthOf(1);
        });

        it('should return correctly filterred data (case 2)', function() {

            var filtered = objectFilter.filterData(this.data, {
                street: {
                    $like: {$any: ['Nad Pomnikem', 'Stepanska']}
                }
            }, {dataProperty: null})

            filtered.should.include(this.data[0]);
            filtered.should.include(this.data[1]);
            filtered.should.have.lengthOf(2);
        });

        it('should return correctly filterred data (case 3 - `or` condition)', function() {

            var filtered = objectFilter.filterData(this.data, {
                $or: {
                    name: 'John Snow',
                    street: 'Plzenska'

                }
            }, {dataProperty: null})

            filtered.should.include(this.data[0]);
            filtered.should.include(this.data[2]);
            filtered.should.have.lengthOf(2);
        });

        it('should return correctly filterred data (case 4 - `or` condition)', function() {

            var filtered = objectFilter.filterData(this.data, {
                country: {
                    code_2: {
                        $or: [
                            {
                                $eq: 'CZ'
                            },
                            {
                                $eq: 'RU'
                            },
                        ]
                    }
                }
            }, {dataProperty: null})

            filtered.should.include(this.data[1]);
            filtered.should.include(this.data[2]);
            filtered.should.have.lengthOf(2);
        });

        it('should accept the `dataProperty` option', function() {
            var filtered = objectFilter.filterData(this.data, {
                code_2: {
                    $in: ['US', 'CZ', 'RU']
                }
            }, {dataProperty: 'country'})

            filtered.should.have.lengthOf(3);
        });
    });
});
