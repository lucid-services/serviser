const request   = require('supertest');
const http      = require('http');
const Express   = require('express');

const RequestError   = require('../../../lib/error/requestError.js');
const reqContentType = require('../../../lib/middleware/requestContentType.js');

function createServer(supportedContentTypes) {
    var context = {
        route: {
            $reqDataParser: {
                contentTypes: supportedContentTypes,
                mediaTypes: Object.keys(supportedContentTypes)
            }
        }
    };
    let fn = Express();
    fn.all('/', function(req, res) {
        return reqContentType.call(context, req, res).then(function() {
            res.statusCode = 200;
            res.setHeader('req-body', JSON.stringify(req.body || ''));
            res.end();
        }).catch(RequestError, function(err) {
            res.statusCode = 400;
            res.end(err.__proto__.constructor.name);
        });
    })
    return http.createServer(fn)
}

describe('requestContentType middleware', function() {

    [
        {
            type: 'application/json',
            data: JSON.stringify({data: 'data'}),
            method: 'post',
            supported: {
                json: {}
            }
        },
        {
            type: 'application/json',
            data: JSON.stringify({data: 'data'}),
            method: 'post',
            supported: {
                'application/json': {
                    type: 'application/json'
                }
            }
        },
        {
            type: 'application/x-www-form-urlencoded',
            data: JSON.stringify({data: 'data'}),
            method: 'post',
            supported: {
                urlencoded: {}
            }
        },
        {
            type: '',
            data: '',
            method: 'get',
            supported: {
                json: {}
            }
        }
    ].forEach(function(item, index) {
        it(`should PASS req content-type validation (${index})`, function(done) {

            let server = createServer(item.supported);

            let test = request(server)[item.method]('/');
            test.set('Content-Type', item.type);
            test.write(item.data);
            test.expect(200, '', done);
        });
    });

    [
        {
            type: 'json',
            method: 'get',
            data: '',
            supported: {
                'application/json': {type: 'application/json'}
            }
        },
        {
            type: 'urlencoded',
            method: 'post',
            data: JSON.stringify({data: 'data'}),
            supported: {
                'application/x-www-form-urlencoded': {type: 'application/x-www-form-urlencoded'}
            }
        },
        {
            type: 'application/json',
            method: 'post',
            data: JSON.stringify({data: 'data'}),
            supported: {
                'application/x-www-form-urlencoded': {type: 'application/x-www-form-urlencoded'}
            }
        },
        {
            type: 'application/x-www-form-urlencoded',
            method: 'post',
            data: JSON.stringify({data: 'data'}),
            supported: {
                'application/json': {type: 'application/json'}
            }
        },
    ].forEach(function(item, index) {
        it(`should FAIL req content-type validation (${index})`, function(done) {

            let server = createServer(item.supported);

            let test = request(server)[item.method]('/');
            test.set('Content-Type', item.type);
            test.write(item.data);
            test.expect(400, 'RequestError', done);
        });
    });

    it(`should set empty object to the req.body if conent-type parser did not populate it`, function(done) {

        let server = createServer({
            'multipart/form-data': {}
        });

        return request(server)
            .post('/')
            .set('Content-Type', 'multipart/form-data')
            .expect('req-body', '{}')
            .expect(200, '', done);
    });
});
