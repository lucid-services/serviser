/**
 * @constant MAX_BODY_SIZE
 * @type {string}
 */
var MAX_BODY_SIZE = '2mb';

module.exports = function(req, res) {
    return new Promise(function(resolve, reject) {
        if (req.headers['content-type'] && req.headers["content-type"].indexOf("application/octet-stream") != -1) {
            return getRawBody(req, {
                length: req.headers['content-length'],
                limit: MAX_BODY_SIZE,
            }, function (err, string) {
                if (err) {
                    return reject(err);
                }
                req.rawBody = string;
                return resolve();
            });
        } else {
            return resolve();
        }
    });
};
