
module.exports = Response;

/**
 * Response
 *
 * @param {Function} cb - callback function which actually sets response on the express `res` object. It's context is always set to the `res` object
 *
 * @constructor
 * @return {Response}
 */
function Response(cb) {
    if (!(this instanceof Response)) {
        return new Response(cb);
    }

    this._fn = cb;
}
