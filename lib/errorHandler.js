const debug = require('debug')('errorHandler');

const RequestError = require('./error/requestError.js');
const ServiceError = require('./error/serviceError.js');

module.exports = errorHandler;

//just so that we can properly test the recursive function
errorHandler.errorHandler = errorHandler;

/*
 * @private
 * @param {Error} err
 * @param {AppInterface} app
 * @param {Object} options
 * @param {String} [options.routeUID] - can be empty (eg. RouteNotFoundError)
 * @param {String} options.reqUID
 * @return {RequestError}
 */
function errorHandler(err, app, options) {
    options = options || {};

    if (err instanceof RequestError) {
        if (err instanceof ServiceError) {
            err.setOrigin(options.routeUID);
            err.setUID(options.reqUID);
            app.emit('error', err);
        }

        debug(err.stack);
        return err;
    // matches every error object which includes the Error.prototype
    // in it's prototype chain and at the same time the error object is not dirrect
    // instance of the Error
    } else if (Error.prototype.isPrototypeOf(Object.getPrototypeOf(err))) {
        if (app.listenerCount('unknown-error')) {
            return app.emit('unknown-error', err, function(error) {
                if (!(error instanceof RequestError)) {
                    error = ServiceError.buildFrom(error);
                }
                return errorHandler.errorHandler(error, app, options);
            });
        }
        return errorHandler.errorHandler(ServiceError.buildFrom(err), app, options);

    } else if (err instanceof Error) {
        return errorHandler.errorHandler(ServiceError.buildFrom(err), app, options);
    }
};
