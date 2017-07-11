var _      = require('lodash');
var typeis = require('type-is');

var RequestError = require('../error/requestError.js');

/**
 * @this {App}
 */
module.exports = function requestContentType(req, res, next) {
    var types = this.config.getOrFail('bodyParser');
    var type = req.header('content-type');

    types = _.reduce(types, function(out, type, key) {
        out.push(type.type || key);
        return out;
    }, []);

    if (type && typeis.is(type, types)) {
        return next();
    } else if (type === undefined
        && ~['get', 'options'].indexOf(req.method.toLowerCase())
    ) {
        return next();
    }

    return next(new RequestError(`Unsupported Content-Type: ${type}. Supported: ${types.join('|  ')}`));
};
