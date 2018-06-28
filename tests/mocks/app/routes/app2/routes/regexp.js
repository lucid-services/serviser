'use strict'

const router = require('../router.js');

const route = router.buildRoute({
    type: 'post',
    name: 'validateBody',
    url : /\/validate\/body/,
});

route.validate({
    additionalProperties: false,
    properties: {
        username: {type: 'string'},
        email: {type: 'string', format: 'email'}
    }
}, 'body');

route.main(function (req, res) {
    res.json(req.body);
});
