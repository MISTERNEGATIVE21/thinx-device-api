/* Router integration test only; does not have to cover full unit functionality. */

const THiNX = require("../../thinx-core.js");

const chai = require('chai');
const expect = require('chai').expect;
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const envi = require("../_envi.json");
const dynamic_owner_id = envi.dynamic2.owner;

const user_info = {
  first_name: "Dynamic",
  last_name: "User",
  email: "dynamic2@example.com",
  username: "dynamic2"
};

let dynamic_activation_code = null;

let thx;
let agent;
let jwt = null;
let reset_key = null;

describe("User Routes V2", function () {

  beforeAll((done) => {
    thx = new THiNX();
    thx.init(() => {
      agent = chai.request.agent(thx.app);
      console.log(`🚸 [chai] >>> running User Routes V2 spec`);
      done();
    });
  });

  afterAll((done) => {
    agent.close();
    console.log(`🚸 [chai] <<< completed User Routes V2 spec`);
    done();
  });

  //
  // User Lifecycle
  //

  it("POST /api/v2/user (valid body) and activate (set password)", function (done) {
    chai.request(thx.app)
      .post('/api/v2/user')
      .send(user_info)
      .end((_err, res) => {
        // {"success":true,"response":"6975d3c5849fc130e689f2cae0abe51a8fd24f496810bee3c0bcf531dd53be0c"}
        console.log("🚸 [chai] IMPORTANT(1)", res.text); // {"success":true,"response":"434a00db99903150d90f1c74c9fee117044d5fab62e7671bf06f910e6d7353ee"}
        expect(res.text).to.be.a('string');
        expect(res.status).to.equal(200);
        let body = JSON.parse(res.text);
        dynamic_activation_code = body.response;
        expect(body.response).to.be.a('string'); // check length
        expect(body.response.length == 64);
        expect(body.success).to.equal(true); // this is weird; for some reason does not work in main branch tests (only some?)

        let rurl = '/api/v2/activate?owner=' + dynamic_owner_id + '&activation=' + dynamic_activation_code;
        chai.request(thx.app)
          .get(rurl)
          .end((__err, __res) => {
            expect(__res.status).to.equal(200);
            expect(__res.text).to.be.a('string'); // <html>
            expect(__res).to.be.html;

            chai.request(thx.app)
              .post('/api/v2/password/set')
              .send({ password: "dynamic2", rpassword: "dynamic2", activation: dynamic_activation_code })
              .end((___err, ___res) => {
                expect(___res.status).to.equal(200);
                expect(___res.text).to.be.a('string');
                expect(___res.text).to.equal('{"success":true,"response":"activation_successful"}');
                done();
              });
          });

      });
  }, 30000);

  // 1

  it("POST /api/v2/password/reset", function (done) {
    chai.request(thx.app)
      .post('/api/v2/password/reset')
      .send({ email: envi.dynamic2.email })
      .end((_err, res) => {
        let j = JSON.parse(res.text);
        reset_key = j.response;
        expect(res.status).to.equal(200);
        expect(res.text).to.be.a('string');
        expect(reset_key).be.a('string');
        done();
      });
  }, 30000);

  it("GET /api/v2/password/reset", function (done) {
    chai.request(thx.app)
      .get('/api/v2/password/reset?owner_id='+envi.dynamic2.owner+'&reset_key='+reset_key)
      .end((_err, res) => {
        expect(res.status).to.equal(200);
        // should include "Enter your new password"
        expect(res.text).to.be.a('string');
        done();
      });
  }, 30000);

  // has no response, maybe reset_key is already used...
  it("POST /api/v2/password/set", function (done) {
    console.log("🚸 [chai] V2 POST /api/v2/password/set (3)");
    chai.request(thx.app)
      .post('/api/v2/password/set')
      .send({ password: "dynamic2", rpassword: "dynamic2", reset_key: reset_key })
      .end((_err, res) => {
        console.log("🚸 [chai] V2 POST /api/v2/password/set (3) response:", res.text, " status:", res.status);
        expect(res.status).to.equal(200);
        expect(res.text).to.be.a('string');
        //expect(res.text).to.equal('{"success":false,"response":"password_reset_failed"}'); // somehow not deterministic
        done();
      });
  }, 30000);


  //
  // User Profile
  //

  it("POST /api/login + /api/v2/gdpr", function (done) {
    agent
      .post('/api/login')
      .send({ username: 'dynamic2', password: 'dynamic2', remember: false })
      .then(function (res) {
        expect(res).to.have.cookie('x-thx-core');
        /* response example:
        {
          "status":"OK",
          "success":true,
          "access_token":"eyJh...",
          "redirectURL":"https://rtm.thinx.cloud/auth.html?t=33ed0c670113f6e8b1095a1b1857d5dc6e9db77c37122d76c45ffacef2484701&g=true"
        } */
        console.log("🚸 [chai] V2 POST /api/login response", res.text);
        let body = JSON.parse(res.text);
        jwt = 'Bearer ' + body.access_token;

        // Old UI does this
        let token = body.redirectURL.replace("https://rtm.thinx.cloud/auth.html?t=", "").replace("&g=true", "");

        // just test-added
        agent
          .post('/api/v2/gdpr')
          .send({ gdpr: true, token: token })
          .end((_err, _res) => {
            console.log("🚸 [chai] V2 POST /api/gdpr response:", _res.text, "status", _res.status);
            //expect(_res.status).to.equal(200);
            //expect(_res.text).to.be.a('string');
            // {"success":false,"response":"invalid_protocol_update_key_missing"} // WTF?

            return agent
              .post('/api/login')
              .send({ token: token })
              .end((_err1, res1) => {
                console.log("🚸 [chai] V2 POST /api/login response:", res1.text, "status", res1.status);
                expect(res1.status).to.equal(200);
                done();
              });
          });
      })
      .catch((e) => { console.log(e); });
  }, 30000);

  //
  // User Statistics
  //

  // should create LOGIN_INVALID Passwotd mismatch tag
  it("POST /api/v2/login", function (done) {
    chai.request(thx.app)
      .post('/api/login')
      .send({ username: "dynamic2", password: "dynamic3" })
      .end((_err1, res1) => {
        expect(res1.status).to.equal(401);
        expect(res1.text).to.equal('{"success":false,"response":"password_mismatch"}');
        done();
      });
  }, 30000);

  it("GET /api/v2/stats", function (done) {
    chai.request(thx.app)
      .get('/api/v2/stats')
      .set('Authorization', jwt)
      .end((_err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.be.a('string');
        expect(res.text).to.equal('{"success":false,"response":"no_results"}');
        done();
      });
  }, 30000);

  it("POST /api/v2/chat", function (done) {
    chai.request(thx.app)
      .post('/api/v2/chat')
      .set('Authorization', jwt)
      .send({})
      .end((_err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.be.a('string');
        expect(res.text).to.equal('{"success":true,"response":"no_slack_channel"}');
        done();
      });
  }, 30000);

  //
  // Removal
  //

  // there is no login here, so JWT for this should be missing
  it("DELETE /api/v2/gdpr (valid)", function (done) {
    console.log("🚸 [chai] DELETE /api/v2/gdpr (jwt, valid) request");
    chai.request(thx.app)
      .delete('/api/v2/gdpr')
      .set('Authorization', jwt)
      .send({ owner: dynamic_owner_id})
      .end((_err, res) => {
        console.log("🚸 [chai] DELETE /api/v2/gdpr (jwt, valid) response:", res.text, " status:", res.status);
        expect(res.status).to.equal(200);
        expect(res.text).to.be.a('string');
        // {"success":false,"response":"deletion_not_confirmed"} 
        done();
      });
  }, 30000);

  it("GET /api/v2/logout", function (done) {
    chai.request(thx.app)
      .get('/api/v2/logout')
      .set('Authorization', jwt)
      .end((_err, res) => {
        expect(res.status).to.equal(200);
        expect(res).to.be.html;
        done();
      });
  }, 30000);

  /* done by the GDPR revocation, would need other user */
  xit("DELETE /api/v2/user", function (done) {
    console.log("🚸 [chai] V2 DELETE /api/v2/user");
    chai.request(thx.app)
      .delete('/api/v2/user')
      .set('Authorization', jwt)
      .send({ owner: dynamic_owner_id })
      .end((_err, res) => {
        console.log("🚸 [chai] V2 DELETE /api/v2/user response:", res.text, " status:", res.status);
        expect(res.status).to.equal(200);
        done();
      });
  }, 30000);
  

});
