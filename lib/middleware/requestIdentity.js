var _ = require('lodash');

module.exports = function requestIdentity(req, res, next) {
    req.UID = Date.now() + _.random(100, 999);
    return next();
};
