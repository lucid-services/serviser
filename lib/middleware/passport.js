var passport = require('passport');
var debug    = require('debug')('passportMiddleware');

var RequestError               = require('../error/requestError.js');
var UnauthorizedError          = require('../error/unauthorizedError.js');
var IncompleteDataError        = require('../error/incompleteDataError');

var thirdPartySericeTypes = [ "twitter", "facebook", "steam", "google" ];

module.exports = function (type, options) {

    return function (req, res, next) {

        if (type == 'session') {
            if (req.isAuthenticated()) {
                return next();
            } else {
                return next(new Error('Permission Error (todo)'));// Important error without a message!
            }
        }

        return passport.authenticate(type, options, function (err, user, info) {
            debug('custom passportMiddleware err', err);
            debug('custom passportMiddleware', user);

            var credentialsError = new Error('The email address or password is incorrect. Please try again.');
            var clientError      = new UnauthorizedError();

            if (err) {
                if (   thirdPartySericeTypes.indexOf(type[0]) !== -1
                    && !(err instanceof NotEnoughDataReceivedError)
                ) {
                    debug("THIRD PARTY LOGIN", type, err.stack);
                    if (req.session.state) {
                        try {
                            var state = req.session.state;
                            if (state.flow === 'own-window') {
                                return res.redirect("/profile");
                            }
                        } catch (e) {
                            return next(new Error('Failed to parse session `state` data'));
                        }

                        if (state.flow === 'redirect') {
                            return res.redirect(req.session.redirect_url)
                        }
                    }
                    return res.redirect("/?cf=true");
                }
                return next(err);
            }

            if (type == 'oauth2-client-password' && !user) {
                return next(clientError);
            } else if (!user) {
                return next(credentialsError);
            }

            if (type == 'local' || options.session === true) {
               return req.logIn(user, function (err) {
                    if (err) {
                        return next(err);
                    }
                    req.session.ipAddress = req.ip;
                    req.session.userAgent = req.headers['user-agent'];

                    if (type == "local" && req.getData('remember') == true) {
                        var SESS_LENGTH = 3600000 * 24 * 30;
                        req.session.cookie.maxAge = SESS_LENGTH;
                    }

                   return next();
                });
            } else {
                req.user = user;
            }
            debug('user ', user);

            return next();

        })(req, res, next);
    }
};
