let HttpStatus         = require('http-status-codes');
var logger             = require('bi-logger');
let debug              = require('debug')('errorHandlerMiddleware');

let RouteNotFoundError = require('../error/routeNotFoundError.js');
let RequestError       = require('../error/requestError.js');
let ServiceError       = require('../error/serviceError.js');
let AppStatus          = require('./appStatus.js');

/**
 * Global error handler middleware
 *
 * @this === App
 */
module.exports = function (err, req, res, next) {
    if (err === undefined) {
        return next();

    } else if (err instanceof RouteNotFoundError) {
        return res.status(HttpStatus.NOT_FOUND).json(err);

    } else if (err instanceof RequestError) {
        return res.status(err.statusCode).json(err);

    } else if (err instanceof ServiceError) { //deprecated - will be removed
        return res.status(HttpStatus.BAD_REQUEST).json(err);

    } else if (err instanceof Error) {

        logger.err(err.stack);
        debug(err.stack);
        debug('This note will shutt down to prevent any further data damage')

        this.$setStatus(AppStatus.ERROR);
        return res.status(HttpStatus.BAD_REQUEST).json(err);
    }
};
