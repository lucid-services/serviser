let RouteNotFoundError = require('../error/routeNotFoundError.js');

module.exports = function (req, res, next) {
    if (!res.headersSent) {
        return next(new RouteNotFoundError())
    }
};
