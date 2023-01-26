/*
 * This THiNX Login Helper used by router as JWT implementation.
 * Requires application's Redis instance to generate and keep secret key between restarts.
 * THREAT ANALYSIS: If this secret key leaks, it could lead to breaking whole system security. 
 */

const jwt = require("jsonwebtoken");

const JWT_KEY = "__JWT_SECRET__";

let jwt_options = { algorithm: 'HS512' }; // should be taken from config, not hardcoded
module.exports = class JWTLogin {

    // Static Constructor

    constructor(redis) {
        if (!redis) throw new Error("Bad JWTLogin initialization, needs valid/connected Redis.");
        this.redis = redis;
        this.initialized = false;
        this.secretkey = null; // class could be per-user
    }

    // Private Functions

    // JWT Implementation requires a JWT_SECRET_KEY value, which should be random on start,
    // but should allow decoding valid tokens between app restarts. Therefore it's stored in Redis.

    createSecretKey(callback) {
        require('crypto').randomBytes(48, (_ex, buf) => {
            let new_key = buf.toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
            callback(new_key);
        });
    }

    // Should be called after each restart; sessions will die but security in case of app in exception will be reset
    resetSecretKey(callback) {
        this.createSecretKey((key) => {
            this.redis.v4.set(JWT_KEY, key).then(() => {
                callback(key);
            });
        });
    }

    revokeSecretKey(callback) {
        this.redis.v4.del(JWT_KEY).then((err) => {
            callback(err);
        });
    }

    fetchOrCreateSecretKey(callback) {
        this.redis.v4.get(JWT_KEY).then((result) => {
            if (result) {
                callback(result);
            } else {
                this.createSecretKey((key) => {
                    this.redis.v4.set(JWT_KEY, key).then(() => {
                        callback(key);
                    });
                });
            }
        });
    }

    //
    // Usage
    //

    // Step 1: Initialize key from Redis or create new and save; separated for testability

    init(callback) {
        if ((typeof (this.secretkey) !== "undefined") && (this.secretkey !== null)) {
            return callback(this.secretkey);
        }
        this.fetchOrCreateSecretKey((secretkey) => {
            this.secretkey = secretkey;
            this.initialized = true;
            callback(secretkey);
        });
    }

    // Step 2: Sign

    sign(uid, callback) {
        this.fetchOrCreateSecretKey((secretkey) => {
            let payload = {
                username: uid,
                scope: '/api/',
                exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
            };
            let cb = (err, jwt_token) => {
                if (err !== null) console.log("[jwt] sign callback error", err);
                callback(jwt_token);
            };
            jwt.sign(payload, secretkey, jwt_options,  cb );
        });
    }

    sign_with_refresh(uid, callback) {
        this.fetchOrCreateSecretKey((secretkey) => {
            let access_payload = {
                username: uid,
                scope: '/api/',
                exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
            };
            let cb1 = (err1, access_token) => {
                if (err1 !== null) console.log("[jwt] sign callback error (1)", err1);
                let refresh_payload = {
                    username: uid,
                    scope: '/api/v2/login',
                    exp: Math.floor(Date.now() / 1000) + (60 * 60) * 168 // 1 week
                };
                let cb2 = (err2, refresh_token) => {
                    if (err2 !== null) console.log("[jwt] sign callback error (2)", err2);
                    callback(access_token, refresh_token);
                };
                jwt.sign(refresh_payload, secretkey, jwt_options,  cb2 );
            };
            jwt.sign(access_payload, secretkey, jwt_options,  cb1 );
        });
    }

    // Step 3: Verify

    verify_impl(req, callback) {
        const auth_header = req.headers.authorization || req.headers.Authorization;
        if (typeof(auth_header) === "undefined") {
            console.log("!!! [debug] Invalid request header in jwt-verify_impl");
            return callback(false);
        }
        let token = auth_header.split(' ')[1];
        if (typeof(token) === "undefined") return callback(false, "invalid auth token");
        token = token.replace("Bearer ", "");
        let sck = this.secretkey;
        jwt.verify(
            token,
            sck,
            jwt_options, // should be taken from config, not hardcoded
            callback
        );
    }

    verify(req, callback) {
        // guard
        if ((typeof (req.headers.authorization) !== "undefined") && (typeof (req.headers.Authorization) !== "undefined")) {
            console.log("☣️ [error] Invalid request header in jwt-verify, req:", {req});
            callback(false);
        }
        // key guard
        if (this.initialized === false) {
            this.init(() => {
                // retry
                this.verify_impl(req, callback);
            });
        } else {
            // try
            this.verify_impl(req, callback);
        }
    }

};
