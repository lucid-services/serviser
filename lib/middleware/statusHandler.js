var Promise = require('bluebird');
var STATUS  = require('server-status').STATUSES;

module.exports = function (req, res) {
    return new Promise(function(resolve, reject) {
        var nodeStatus = req.app.locals.serverStatus.getStatus();

        if (nodeStatus === STATUS.STATUS_INIT || nodeStatus === STATUS.STATUS_ERROR) {
            return reject(new Error('Service not in proper state ' + nodeStatus));
        }

        return resolve();
    });
}

