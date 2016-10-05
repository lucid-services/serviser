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
    if (err === undefined || err === null) {
        return next();

    } else if (err instanceof RouteNotFoundError) {
        return res.status(HttpStatus.NOT_FOUND).json(err);

    } else if (err instanceof RequestError) {
        return res.status(err.statusCode).json(err);

    } else if (err instanceof ServiceError) {
        return internalError(err);

    } else if (Error.prototype.isPrototypeOf(Object.getPrototypeOf(err))) {
        return this.emit('unknown-error', err, function(error) {
            return errorHandler(error, req, res, next);
        });

    } else if (err instanceof Error) {
        return internalError(err);
    }

    function internalError(err) {
        logger.err(err.stack);
        debug(err.stack);
        debug('This node will shutt down to prevent any further data damage')

        this.$setStatus(AppStatus.ERROR);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(err);
    }
};
