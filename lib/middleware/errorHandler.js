const ServiceError = require('../error/serviceError.js');
const errorHandler = require('../errorHandler.js');

module.exports = middleware;

/*
 * @private
 * Express error handler middleware
 *
 * @this === App
 */
function middleware(err, req, res, next) {
    let app = this;

    if (err === undefined) {
        return next();

    } else if (err === null) {
        err = new ServiceError({
            message: 'Got error of type NULL in the Error Hanlder middleware'
        });

    }

    let error = errorHandler.errorHandler(err, app, {
        reqUID: req.UID,
        routeUID: req.routeUID
    });

    return app.emitAsyncSeries('error-response', err, res).catch(function(err) {
        app.emit('error', err);
    });
};
