'use strict'

const RequestError = require('../../../../../lib/error/requestError.js');
const router = require('../router.js');

const route = router.buildRoute({
    type: 'get',
    url : '/request/error',
});

route.main(function (req, res) {
    throw new RequestError('user targetted error message');
});
