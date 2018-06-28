'use strict'

const router = require('../router.js');

const route = router.buildRoute({
    type: 'get',
    url : '/internal/error',
});

route.main(function (req, res) {
    throw new Error('unexpected internal fatal error');
});
