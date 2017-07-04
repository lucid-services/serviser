var typeis = require('type-is');

var RequestError = require('../error/requestError.js');

/**
 * @this {App}
 */
module.exports = function requestContentType(req, res, next) {
    var types = Object.keys(this.config.getOrFail('bodyParser'));
    var type = req.header('content-type');

    if (type && typeis.is(type, types)) {
        return next();
    }

    return next(new RequestError(`Unsupported Content-Type: ${type}. Supported: ${types.join('|  ')}`));
};
