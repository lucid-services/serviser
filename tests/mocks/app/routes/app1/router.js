const service = require('../../index.js');

const router = service.appManager.get('app1').buildRouter({
    version: 1.0,
    url: '/'
});

module.exports = router;
