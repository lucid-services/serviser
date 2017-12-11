const AppStatus    = require('./../common/appStatus');
const ServiceError = require('./../error/serviceError');

module.exports = function(req, res, next) {
    if(AppStatus.ERROR === this.status) {
        return next(new ServiceError({
            message: 'Service is not in proper state: ' + this.status
        }));
    }
    return next();
}
