var chai = require('chai');
chai.should();

var RestrictIpMiddleware = require('./../../../lib/middleware/restrictIp.js');
var RequestError = require('./../../../lib/error/requestError.js');
var restrictIp = new RestrictIpMiddleware();

describe('restrict ip middleware', function () {

    it('should resolve if ip address is in client\'s ips array',
        function (done) {

            var req = {
                ip: '::ffff:127.0.0.1',
                client: {
                    ips: ['::ffff:127.0.0.1', '::ffff:127.0.0.2']
                }
            };

            restrictIp(req)
            .then(function(){
                done();
            })
            .catch(function(e){
                done(e);
            });
        }
    );

    it('should resolve if ip address is in client\'s ips string',
        function (done) {
            
            var req = {
                ip: '::ffff:127.0.0.1',
                client: {
                    ips: '::ffff:127.0.0.1'
                }
            };

            restrictIp(req)
            .then(function(){
                done();
            })
            .catch(function(e){
                done(e);
            });
        }
    );

    it('should reject if client\'s ips is undefined',
        function (done) {
            
            var req = {
                ip: '::ffff:127.0.0.1',
                client: {}
            };

            restrictIp(req)
            .then(function(){
                done(new Error('Should not resolve'));
            })
            .catch(function(e){
                e.should.be.instanceOf(RequestError);
                e.should.have.property('message', 'Ip addresses must be set');                
                e.should.have.property('code', 400);                
                done();
            });
        }
    );

    it('should reject if provided ip address is not allowed',
        function (done) {
            
            var req = {
                ip: '::ffff:127.0.0.3',
                client: {
                    ips: ['::ffff:127.0.0.1', '::ffff:127.0.0.2']
                }
            };

            restrictIp(req)
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

    it('should reject if ip address was not supplied',
        function (done) {
            
            var req = {                
                client: {
                    ips: ['::ffff:127.0.0.1', '::ffff:127.0.0.2']
                }
            };

            restrictIp(req)
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

});
