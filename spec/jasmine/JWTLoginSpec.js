var JWTLogin = require("../../lib/thinx/jwtlogin");
var expect = require('chai').expect;

const Globals = require("../../lib/thinx/globals.js");
const envi = require("../_envi.json");
const owner = envi.oid;
const username = envi.username;

const redis_client = require('redis');
const redis = redis_client.createClient(Globals.redis_options());

const login = new JWTLogin(redis);

describe("JWT Login", function () {

    it("should generate secret in order to sign first request", function (done) {
        login.init((key) => {
            expect(key).to.be.a('string');
            login.sign(username, owner, (response) => {
                expect(response).to.be.a('string');
                done();
            });
        });
    }, 5000);

    it("should sign and verify", function (done) {
        login.sign(username, owner, (response) => {
            expect(response).to.be.a('string');
            let mock_req = {
                "headers" : {
                    "Authorization" : 'Bearer ' + response
                }
            };
            login.verify(mock_req, (error, payload) => {
                console.log("JWT Secret verification results:", {error}, {payload});
                expect(error).to.equal(null);
                expect(payload).to.be.a('string');
                done();
            });
        });
    }, 5000);
});
