var chai = require('chai');
chai.should();

var RestrictOriginMiddleware = require('./../../../lib/middleware/restrictOrigin.js');
var RequestError = require('./../../../lib/error/requestError.js');
var restrictOrigin = RestrictOriginMiddleware();

describe('Restrict origin middleware', function () {

    describe('unifyUrl()', function () {

        it('should unify url',
            function (done) {
                var url = 'http://localhost/spare&part=true';
                var result = RestrictOriginMiddleware.unifyUrl(url);
                result.should.be.an('string').and.equals('http://localhost');
                done();
            }
        );

        it('should unify ip address',
            function (done) {
                var url = 'http://127.0.0.1:3030/spare&part=true';
                var result = RestrictOriginMiddleware.unifyUrl(url);
                result.should.be.an('string').and.equals('http://127.0.0.1:3030');
                done();
            }
        );

        it('shouldn\'t modify unified url',
            function (done) {
                var url = 'http://localhost';
                var result = RestrictOriginMiddleware.unifyUrl(url);
                result.should.be.an('string').and.equals(url);
                done();
            }
        );
    });

    describe('restrict origin middleware', function () {

        it('should resolve on origin supplied',
            function (done) {
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
                
                restrictOrigin(req)
                .then(function(){
                    done();
                })
                .catch(function(e){
                    done(e);
                });
            }
        );

        it('should resolve on referer supplied',
            function (done) {
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
                
                restrictOrigin(req)
                .then(function(){
                    done();
                })
                .catch(function(e){
                    done(e);
                });
            }
        );

        it('should resolve if domains is string',
            function (done) {
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
                
                restrictOrigin(req)
                .then(function(){
                    done();
                })
                .catch(function(e){
                    done(e);
                });
            }
        );

        it('should resolve if domains is regexpr',
            function (done) {
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
                
                restrictOrigin(req)
                .then(function(){
                    done();
                })
                .catch(function(e){
                    done(e);
                });
            }
        );

        it('should reject if origin and referer wasn\'t supplied',
            function (done) {
                var req = {
                    headers: {},
                    client: {
                        domains: ['http://correct']
                    },
                    get: function () {
                        return;
                    }
                };
                restrictOrigin(req)
                .then(function(){
                    done(new Error('Should not resolve'));
                })
                .catch(function(e){
                    e.should.be.instanceOf(RequestError);
                    e.should.have.property('message', 'Forbidden');
                    e.should.have.property('code', 403);
                    done();
                });
            }
        );

        it('should reject if supplied origin is incorrect',
            function (done) {
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

                restrictOrigin(req)
                .then(function(){
                    done(new Error('Should not resolve'));
                })
                .catch(function(e){
                    e.should.be.instanceOf(RequestError);
                    e.should.have.property('message', 'Forbidden');
                    e.should.have.property('code', 403);
                    done();
                });                
            }
        );

        it('should reject if supplied referer is incorrect',
            function (done) {
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
                
                restrictOrigin(req)
                .then(function(){
                    done(new Error('Should not resolve'));
                })
                .catch(function(e){
                    e.should.be.instanceOf(RequestError);
                    e.should.have.property('message', 'Forbidden');
                    e.should.have.property('code', 403);
                    done();
                }); 
            }
        );

        it('should reject if client\'t domains wasn\'t supplied',
            function (done) {
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
                
                restrictOrigin(req)
                .then(function(){
                    done(new Error('Should not resolve'));
                })
                .catch(function(e){
                    e.should.be.instanceOf(RequestError);
                    e.should.have.property('message', 'Domains must be set');
                    e.should.have.property('code', 400);
                    done();
                }); 
            }
        );
    });
});
