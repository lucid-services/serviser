'use strict'

const router = require('../router.js');

const route = router.buildRoute({
    type: 'get',
    url : '/pagination',
});

route.validate({
    properties: {
        limit: {type: 'number', minimum: 0},
        offset: {type: 'number', minimum: 0}
    }
}, 'query');

route.main(function (req, res) {
    res.setPaginationHeaders(Object.assign({
        count: 100
    }, req.query));

    res.json([].fill(0, req.query.limit || 99, 'value'));
});
