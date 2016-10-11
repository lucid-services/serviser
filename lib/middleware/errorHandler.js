var HttpStatus = require('http-status-codes');
var logger     = require('bi-logger');
var debug      = require('debug')('errorHandlerMiddleware');

var RouteNotFoundError = require('../error/routeNotFoundError.js');
var RequestError       = require('../error/requestError.js');
var ServiceError       = require('../error/serviceError.js');
var AppStatus          = require('../express/appStatus.js');

/**
 * Global error handler middleware
 *
 * @this === App
 */
module.exports = function errorHandler(err, req, res, next) {
    if (err === undefined) {
        return next();
    } else if (err === null) {
        err = new ServiceError({
            info: 'Got error of type NULL in the Error Hanlder middleware'
        });
        return errorHandler(err, req, res, next);

    } else if (err instanceof RequestError) {

        if (err instanceof ServiceError) {
            debug(err.stack);
            logger.err(err);
            this.$setStatus(AppStatus.ERROR);
            err.setUID(req.UID);
        }

        return res.status(err.code).json(err);

    } else if (Error.prototype.isPrototypeOf(Object.getPrototypeOf(err))) {
        if (this.listenerCount('unknown-error')) {
            return this.emit('unknown-error', err, function(error) {
                return errorHandler(error, req, res, next);
            });
        }
        return errorHandler(new ServiceError(), req, res, next);
    } else if (err instanceof Error) {
        return errorHandler(new ServiceError(), req, res, next);
    }
};
