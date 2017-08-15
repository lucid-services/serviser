/**
 * @typedef RequestType
 * @type {Object}
 * @property {string} GET
 * @property {string} POST
 * @property {string} PUT
 * @property {string} HEAD
 * @property {string} CONNECT
 * @property {string} OPTIONS
 * @property {string} DELETE
 */
module.exports = Object.freeze({
    GET     : 'get',
    POST    : 'post',
    PUT     : 'put',
    HEAD    : 'head',
    CONNECT : 'connect',
    OPTIONS : 'options',
    DELETE  : 'delete'
});
