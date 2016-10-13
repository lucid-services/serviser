var AppStatus    = require('./../express/appStatus');
var ServiceError = require('./../error/serviceError');

module.exports = function(req, res, next) {
    if(AppStatus.ERROR === this.status) {
        return next(new ServiceError('Service is not in proper state: ' + this.status));
    }
    return next();
}
