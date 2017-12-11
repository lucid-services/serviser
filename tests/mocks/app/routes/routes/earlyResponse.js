'use strict'

const router = require('../router.js');

const route = router.buildRoute({
    type: 'get',
    url : '/early/response',
});

route.step('response', function(req, res) {
    return route.buildResponse(function() {
        this.json({ok: 'ok'});
    });
});

route.main(function (req, res) {
    throw new Error('Next middleware should not have been called after early response')
});
