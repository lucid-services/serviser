var chai = require('chai');
chai.should();

var RestrictOriginMiddleware = require('./../../../lib/middleware/restrictOrigin.js');
var RequestError = require('./../../../lib/error/requestError.js');
var ServiceError = require('./../../../lib/error/serviceError.js');
var restrictOrigin = RestrictOriginMiddleware();

describe('restrict origin middleware', function () {

    describe('unifyUrl()', function () {

        it('should unify url',
            function () {
                var url = 'http://localhost/spare&part=true';
                var result = RestrictOriginMiddleware.unifyUrl(url);
                result.should.be.an('string').and.equals('http://localhost');
            }
        );

        it('should unify ip address',
            function () {
                var url = 'http://127.0.0.1:3030/spare&part=true';
                var result = RestrictOriginMiddleware.unifyUrl(url);
                result.should.be.an('string').and.equals('http://127.0.0.1:3030');
            }
        );

        it('shouldn\'t modify unified url',
            function () {
                var url = 'http://localhost';
                var result = RestrictOriginMiddleware.unifyUrl(url);
                result.should.be.an('string').and.equals(url);
            }
        );
    });

    describe('restrict origin middleware', function () {

        it('should resolve on origin supplied',
            function () {
                var req = {
                    client: {
                        domains: ['http://correct']
                    },
                    get: function (param) {
                        if (param === 'Origin') {
                            return 'http://correct';
                        }
                        return;
                    }
                };
                
                restrictOrigin(req).should.be.fulfilled;
            }
        );

        it('should resolve on referer supplied',
            function () {
                var req = {
                    client: {
                        domains: ['http://correct']
                    },
                    get: function (param) {
                        if (param === 'Origin') {
                            return;
                        }
                        if (param === 'Referer') {
                            return 'http://correct';
                        }
                    }
                };
                
                restrictOrigin(req).should.be.fulfilled;
            }
        );

        it('should resolve if domains is string',
            function () {
                var req = {
                    client: {
                        domains: 'http://correct'
                    },
                    get: function (param) {
                        if (param === 'Origin') {
                            return 'http://correct';
                        }
                        if (param === 'Referer') {
                            return 'http://correct';
                        }
                    }
                };
                
                restrictOrigin(req).should.be.fulfilled;
            }
        );

        it('should resolve if domains is regexpr',
            function () {
                var req = {
                    client: {
                        domains: ['^http.*$']
                    },
                    get: function (param) {
                        if (param === 'Origin') {
                            return 'http://correct';
                        }
                        return;
                    }
                };
                
                restrictOrigin(req).should.be.fulfilled;                
            }
        );

        it('should reject if origin and referer wasn\'t supplied',
            function () {
                var req = {
                    headers: {},
                    client: {
                        domains: ['http://correct']
                    },
                    get: function () {
                        return;
                    }
                };
                restrictOrigin(req).should.be.rejected
                .then(function(e){
                    e.should.be.instanceOf(RequestError);
                    e.should.have.property('message', 'Forbidden');
                    e.should.have.property('code', 403);                
                });
            }
        );

        it('should reject if supplied origin is incorrect',
            function () {
                var req = {
                    client: {
                        domains: ['http://correct']
                    },
                    get: function (param) {
                        if (param === 'Origin') {
                            return 'http://incorrect';
                        }
                        return;
                    }
                };

                restrictOrigin(req).should.be.rejected
                .then(function(e){
                    e.should.be.instanceOf(RequestError);
                    e.should.have.property('message', 'Forbidden');
                    e.should.have.property('code', 403);                
                });         
            }
        );

        it('should reject if supplied referer is incorrect',
            function () {
                var req = {
                    client: {
                        domains: ['http://correct']
                    },
                    get: function (param) {
                        if (param === 'Referer') {
                            return 'http://incorrect';
                        }
                        return;
                    }
                };
                
                restrictOrigin(req).should.be.rejected
                .then(function(e){
                    e.should.be.instanceOf(RequestError);
                    e.should.have.property('message', 'Forbidden');
                    e.should.have.property('code', 403);                
                });
            }
        );

        it('should reject if client\'t domains wasn\'t supplied',
            function () {
                var req = {
                    client: {},
                    get: function (param) {
                        if (param === 'Origin') {
                            return 'http://correct';
                        }
                        if (param === 'Referer') {
                            return 'http://correct';
                        }
                    }
                };
                
                restrictOrigin(req).should.be.rejected
                .then(function(e){
                    e.should.be.instanceOf(ServiceError);                         
                }); 
            }
        );
    });
});
