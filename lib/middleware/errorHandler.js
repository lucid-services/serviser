var HttpStatus = require('http-status-codes');
var logger     = require('bi-logger');
var debug      = require('debug')('errorHandlerMiddleware');

var RequestError = require('../error/requestError.js');
var ServiceError = require('../error/serviceError.js');
var AppStatus    = require('../express/appStatus.js');

/**
 * Global error handler middleware
 *
 * @this === App
 */
module.exports = function errorHandler(err, req, res, next) {
    var app = this;

    if (err === undefined) {
        return next();

    } else if (err === null) {
        err = new ServiceError({
            info: 'Got error of type NULL in the Error Hanlder middleware'
        });
        return errorHandler.call(app, err, req, res, next);

    } else if (err instanceof RequestError) {
        if (err instanceof ServiceError) {
            debug(err.stack);
            logger.err(err);
            app.$setStatus(AppStatus.ERROR, err);
            err.setUID(req.UID);
        }

        return res.status(err.code).json(err);

    } else if (Error.prototype.isPrototypeOf(Object.getPrototypeOf(err))) {
        if (app.listenerCount('unknown-error')) {
            return app.emit('unknown-error', err, function(error) {
                if (!(error instanceof RequestError)) {
                    error = ServiceError.buildFrom(error);
                }
                return errorHandler.call(app, error, req, res, next);
            });
        }
        return errorHandler.call(app, ServiceError.buildFrom(err), req, res, next);

    } else if (err instanceof Error) {
        return errorHandler.call(app, ServiceError.buildFrom(err), req, res, next);
    }
};
