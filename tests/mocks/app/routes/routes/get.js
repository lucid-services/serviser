'use strict'

const router = require('../router.js');

const route = router.buildRoute({
    type: 'get',
    url : '/filter',
});

route.respondsWith({
    type: 'object',
    additionalProperties: false,
    properties: {
        username: {type: 'string'},
        email: {type: 'string', format: 'email'}
    }
});

route.main(function (req, res) {
    res.filter({
        username: 'test',
        email: 'test@test.com',
        additional: 'unexpected-value' //should not be included in response
    }).json();
});
