const _              = require('lodash');
const qs             = require('qs');
const findPorts      = require('find-port');
const json5          = require('json5');
const path           = require('path');
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');
const Promise        = require('bluebird');
const config         = require('bi-config');
const request        = require('supertest');

const MOCK_APP_ROOT        = path.resolve(__dirname + '/../../mocks/app');
const MOCK_APP_CONFIG_PATH = path.resolve(MOCK_APP_ROOT + '/config.json5');
const service              = require(path.resolve(MOCK_APP_ROOT + '/index.js'));
const BASE_URL             = 'http://127.0.0.1';

// adds .json5 loader require.extension
require('json5/lib/require');

const expect = chai.expect;

chai.use(chaiAsPromised);
chai.should();

describe('functional server', function() {
    before(function() {
        config.initialize({fileConfigPath: MOCK_APP_CONFIG_PATH});
        return Promise.fromCallback(function(cb) {
            return findPorts('127.0.0.1', 8000, 8025, function(ports) {
                ports = ports || [];

                if (!ports.length) {
                    return cb(new Error('Could not allocate free port in range: 8000-8025'));
                }
                cb(null, ports.pop());
            });
        }).bind(this).then(function(port) {
            return service.listen(port);
        }).then(function() {
            this.server = service.appManager.get('app1').expressApp;
        });
    });

    after(function() {
        return service.close();
    });

    [
        {
            should: 'return json response',
            url: '/early/response',
            method: 'get',
            responseStatus: 200,
            response: {ok: 'ok'}
        },
        {
            should: 'return filtered json response',
            url: '/filter',
            method: 'get',
            responseStatus: 200,
            response: {username: 'test', email: 'test@test.com'}
        },
        {
            should: 'return all supported received req body parameters',
            url: '/validate/body',
            method: 'post',
            contentType: 'application/json',
            data: {
                username: 'test',
                email: 'test@test.com',
                additiona: 'unsupported-value'
            },
            responseStatus: 200,
            response: {
                username: 'test',
                email: 'test@test.com',
            }
        },
        {
            should: 'return json error when we request non-existing endpoint',
            url: '/invalid/endpoint/which/does/not/exist',
            method: 'get',
            responseStatus: 404,
            response: {
                code: 404,
                uid: null,
                api_code: null,
                message: 'Not found'
            }
        },
        {
            should: 'return correctly formated validation error',
            url: '/validate/body',
            method: 'post',
            contentType: 'application/json',
            data: {
                username: 'test',
                email: 'invalid',
            },
            responseStatus: 400,
            response: {
                code: 400,
                uid: null,
                api_code: null,
                message: '.email should match format "email"'
            }
        },
        {
            should: 'return correct response pagination headers',
            url: '/pagination',
            method: 'get',
            query: {
                limit: 25,
                offset: 50
            },
            responseStatus: 200,
            response: [].fill(0, 25, 'val'),
            responseHeaders: {
                Link: `<${BASE_URL}/pagination?limit=25>; rel="first", ` +
                `<${BASE_URL}/pagination?limit=25&offset=75>; rel="last", ` +
                `<${BASE_URL}/pagination?offset=75&limit=25>; rel="next", ` +
                `<${BASE_URL}/pagination?offset=25&limit=25>; rel="prev"`
            }
        },
        {
            should: 'return user targetted error in json format',
            url: '/request/error',
            method: 'get',
            contentType: 'application/json',
            data: '',
            responseStatus: 400,
            response: {
                code: 400,
                uid: null,
                api_code: null,
                message: 'user targetted error message'
            }
        },
        {
            should: 'return internal server error json response',
            url: '/internal/error',
            method: 'get',
            contentType: 'application/json',
            data: '',
            responseStatus: 500,
            response: function(res) {
                res.body.uid.should.be.a('number');
                delete res.body.uid;

                res.body.should.be.eql({
                    code: 500,
                    api_code: null,
                    message: 'Internal Server Error'
                });
            }
        },
    ].forEach(function(req, index) {
        it(`should ${req.should}`, function(done) {
            let query = '';
            if (req.query) {
                query = '?' + qs.stringify(req.query);
            }

            let test = request(this.server)[req.method](req.url + query);
            if (req.contentType) {
                test.set('Content-Type', req.contentType);
            }

            if (req.data) {
                test.write(JSON.stringify(req.data));
            }

            if (req.responseHeaders) {
                Object.keys(req.responseHeaders).forEach(function(header) {
                    test.expect(header, req.responseHeaders[header]);
                });
            }

            if (typeof req.response === 'function') {
                test.expect(req.responseStatus).end(function(err, res) {
                    if (err) {
                        return done(err);
                    }

                    try {
                        req.response(res);
                    } catch(e) {
                        return done(e);
                    }

                    return done();
                });
            } else if (req.hasOwnProperty('response')) {
                test.expect(req.responseStatus, req.response || '', done);
            } else {
                test.expect(req.responseStatus, done);
            }
        });
    });
});
