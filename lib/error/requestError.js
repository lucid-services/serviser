var util            = require('util');
var HttpStatusCodes = require('http-status-codes');

module.exports = RequestError;

/**
 * Error RequestError
 * */
function RequestError(message, code) {

    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor);

    this.name    = this.constructor.name;
    this.code    = code || HttpStatusCodes.BAD_REQUEST;
    this.message = message || 'Bad Request';
}

util.inherits(RequestError, Error);

RequestError.prototype.setUID = function(uid) {
    this.uid = uid
};

RequestError.prototype.toJSON = function() {
    return {
        code: this.code,
        message: this.message,
        uid: this.uid
    };
};
