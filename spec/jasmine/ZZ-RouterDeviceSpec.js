/* Router integration test only; does not have to cover full unit functionality. */

const THiNX = require("../../thinx-core.js");

let chai = require('chai');
var expect = require('chai').expect;
let chaiHttp = require('chai-http');
var envi = require("../_envi.json");
chai.use(chaiHttp);

let thx;

describe("Devices", function () {

  beforeAll((done) => {
    console.log(`🚸 [chai] >>> running Devices spec`);
    thx = new THiNX();
    thx.init(() => {
      done();
    });
  });

  afterAll(() => {
    console.log(`🚸 [chai] <<< completed Devices spec`);
  });

  it("GET /api/user/devices (noauth)", function (done) {
    console.log("🚸 [chai] GET /api/user/devices (noauth)");
    chai.request(thx.app)
      .get('/api/user/devices')
      .end((err, res) => {
        expect(res.status).to.equal(401);
        done();
      });
  }, 20000);

  it("GET /api/user/devices (cookie)", function (done) {
    console.log("🚸 [chai] GET /api/user/devices (cookie)");
    chai.request(thx.app)
      .get('/api/user/devices')
      .set('Cookie', 'thx-session-cookie=something;owner=' + envi.oid)
      .end((err, res) => {
        expect(res.status).to.equal(401);
        done();
      });
  }, 20000);

  it("GET /api/user/device/data/:udid" + envi.oid, function (done) {
    console.log("🚸 [chai] GET /api/user/device/data/:udid");
    chai.request(thx.app)
      .get('/api/user/device/data/' + envi.oid)
      .end((err, res) => {
        expect(res.status).to.equal(404);
        done();
      });
  }, 20000);

  it("POST /api/device/edit", function (done) {
    console.log("🚸 [chai] POST /api/device/edit");
    chai.request(thx.app)
      .post('/api/device/edit')
      .send({ changes: { alias: "edited-alias" } })
      .end((err, res) => {
        expect(res.status).to.equal(401);
        done();
      });
  }, 20000);

  it("POST /api/device/attach", function (done) {
    console.log("🚸 [chai] POST /api/device/attach");
    chai.request(thx.app)
      .post('/api/device/attach')
      .send({ udid: envi.oid })
      .end((err, res) => {
        expect(res.status).to.equal(401);
        done();
      });
  }, 20000);

  it("POST /api/device/detach", function (done) {
    console.log("🚸 [chai] POST /api/device/detach");
    chai.request(thx.app)
      .post('/api/device/detach')
      .send({ udid: envi.oid })
      .end((err, res) => {
        expect(res.status).to.equal(401);
        done();
      });
  }, 20000);

  it("POST /api/device/mesh/attach", function (done) {
    console.log("🚸 [chai] POST /api/device/mesh/attach");
    chai.request(thx.app)
      .post('/api/device/mesh/attach')
      .send({ udid: envi.oid })
      .end((err, res) => {
        expect(res.status).to.equal(401);
        done();
      });
  }, 20000);

  // POST /api/device/mesh/detach
  it("POST /api/device/mesh/detach", function (done) {
    console.log("🚸 [chai] POST /api/device/mesh/detach");
    chai.request(thx.app)
      .post('/api/device/mesh/detach')
      .send({ udid: envi.oid })
      .end((err, res) => {
        expect(res.status).to.equal(401);
        done();
      });
  }, 20000);

  it("POST /api/device/data", function (done) {
    console.log("🚸 [chai] POST /api/device/data");
    chai.request(thx.app)
      .post('/api/device/data')
      .send({ udid: envi.oid })
      .end((err, res) => {
        console.log("🚸 [chai] response /api/device/data:", res.text, " status:", res.status);
        expect(res.status).to.equal(401);
        done();
      });
  }, 20000);

  it("POST /api/device/revoke", function (done) {
    console.log("🚸 [chai] POST /api/device/revoke");
    chai.request(thx.app)
      .post('/api/device/revoke')
      .send({ udid: envi.oid })
      .end((err, res) => {
        expect(res.status).to.equal(401);
        done();
      });
  }, 20000);

  //
  // Device Configuration
  //

  // push device configuration over MQTT
  it("POST /api/device/push", function (done) {
    console.log("🚸 [chai] POST /api/device/push");
    chai.request(thx.app)
      .post('/api/device/push')
      .send({ key: "value" })
      .end((err, res) => {
        expect(res.status).to.equal(401);
        done();
      });
  }, 20000);
});

describe("Devices (JWT)", function () {

  let agent;
  let jwt;

  var JRS5 = {
    mac: "55:55:55:55:55:55",
    firmware: "ZZ-RouterDeviceSpec.js",
    version: "1.0.0",
    alias: "test-device-5-dynamic",
    owner: envi.dynamic.owner,
    platform: "arduino"
  };

  let created_api_key = null;

  beforeAll((done) => {
    console.log(`🚸 [chai] >>> running Devices (JWT) spec`);
    agent = chai.request.agent(thx.app);
    agent
      .post('/api/login')
      .send({ username: 'dynamic', password: 'dynamic', remember: false })
      .then(function (res) {
        console.log(`🚸 [chai] DeviceSpec (JWT) beforeAll POST /api/login (valid) response: ${JSON.stringify(res)}`);
        expect(res).to.have.cookie('x-thx-core');
        let body = JSON.parse(res.text);
        jwt = 'Bearer ' + body.access_token;
        done();
      })
      .catch((e) => { console.log(e); });
  });

  afterAll(() => {
    console.log(`🚸 [chai] <<< completed Devices (JWT) spec`);
    agent.close();
  });

  it("POST /api/user/apikey (D)", function (done) {
    chai.request(thx.app)
      .post('/api/user/apikey')
      .set('Authorization', jwt)
      .send({
        'alias': 'device-apikey-alias'
      })
      .end((err, res) => {
        //  {"success":true,"api_key":"9b7bd4f4eacf63d8453b32dbe982eea1fb8bbc4fc8e3bcccf2fc998f96138629","hash":"0a920b2e99a917a04d7961a28b49d05524d10cd8bdc2356c026cfc1c280ca22c"}
        expect(res.status).to.equal(200);
        let j = JSON.parse(res.text);
        expect(j.success).to.equal(true);
        expect(j.response.api_key).to.be.a('string');
        expect(j.response.hash).to.be.a('string');
        created_api_key = j.response.hash;
        console.log("[spec] saving apikey (D)", j.response.api_key);
        done();
      });
  }, 20000);

  it("POST /device/register (jwt, valid) D", function (done) {

    chai.request(thx.app)
      .post('/device/register')
      .set('Authentication', created_api_key)
      .send({ registration: JRS5 })
      .end((err, res) => {
        console.log("🚸 [chai] POST /device/register (jwt, valid) D response:", res.text);
        expect(res.status).to.equal(200);
        let r = JSON.parse(res.text);
        console.log("🚸 [chai] POST /device/register (jwt, valid) D response:", JSON.stringify(r));
        JRS5.udid = r.registration.udid;
        expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  let dynamic_devices = [];

  it("GET /api/user/devices (JWT)", function (done) {
    console.log("🚸 [chai] GET /api/user/devices (JWT)");
    agent
      .get('/api/user/devices')
      .set('Authorization', jwt)
      .end((err, res) => {
        console.log("🚸 [chai] GET /api/user/devices (JWT) response:", res.text, " status:", res.status);
        let j = JSON.parse(res.text);
        dynamic_devices = j.response;
        expect(res.status).to.equal(200);
        expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("GET /api/user/device/data/:udid" + envi.oid, function (done) {
    console.log("🚸 [chai] GET /api/user/device/data/:udid");
    agent
      .get('/api/user/device/data/' + envi.oid)
      .set('Authorization', jwt)
      .end((err, res) => {
        expect(res.status).to.equal(404);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/edit", function (done) {
    console.log("🚸 [chai] POST /api/device/edit (JWT)");
    agent
      .post('/api/device/edit')
      .set('Authorization', jwt)
      .send({ changes: { alias: "edited-alias", udid: dynamic_devices[1].udid } })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/edit (JWT)response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/attach", function (done) {
    console.log("🚸 [chai] POST /api/device/attach (JWT)");
    agent
      .post('/api/device/attach')
      .set('Authorization', jwt)
      .send({ udid: dynamic_devices[1].udid })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/attach (JWT) response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/attach", function (done) {
    console.log("🚸 [chai] POST /api/device/attach (JWT) 2");
    agent
      .post('/api/device/attach')
      .set('Authorization', jwt)
      .send({ udid: JRS5.udid })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/attach (JWT) 2 response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/detach", function (done) {
    console.log("🚸 [chai] POST /api/device/detach  (JWT)");
    agent
      .post('/api/device/detach')
      .set('Authorization', jwt)
      .send({ udid: dynamic_devices[1].udid })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/detach  (JWT) response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/detach", function (done) {
    console.log("🚸 [chai] POST /api/device/detach  (JWT) 2");
    agent
      .post('/api/device/detach')
      .set('Authorization', jwt)
      .send({ udid: JRS5.udid })
      .end((_err, res) => {
        //console.log("🚸 [chai] POST /api/device/detach  (JWT) 2 response:", res.text, " status:", res.status);
        expect(res.status).to.equal(200);
        expect(res.text).to.be.a('string');
        expect(res.text).to.equal('{"success":true,"response":"detached"}');
        done();
      });
  }, 20000);

  let mesh_id;

  it("POST /api/mesh/create (jwt, valid)", (done) => {
    agent
      .post('/api/mesh/create')
      .set('Authorization', jwt)
      .send({ alias: "device-mesh-alias", owner_id: envi.dynamic.owner, mesh_id: 'device-mesh-id' })
      .end((_err, res) => {
        let r = JSON.parse(res.text);
        mesh_id = r.mesh_id;
        expect(res.status).to.equal(200);
        expect(res.text).to.be.a('string');
        expect(res.text).to.equal('{"success":true,"response":{"mesh_id":"device-mesh-id","alias":"device-mesh-alias"}}');
        done();
      });
  }, 20000);

  it("POST /api/device/mesh/attach", function (done) {
    console.log("🚸 [chai] POST /api/device/mesh/attach (JWT)");
    agent
      .post('/api/device/mesh/attach')
      .set('Authorization', jwt)
      .send({ udid: envi.dynamic.udid, mesh_id: "device-mesh-id" })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/mesh/attach (JWT) response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/mesh/attach", function (done) {
    console.log("🚸 [chai] POST /api/device/mesh/attach (JWT) 2");
    agent
      .post('/api/device/mesh/attach')
      .set('Authorization', jwt)
      .send({ udid: JRS5.udid, mesh_id: mesh_id })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/mesh/attach (JWT) 2 response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/mesh/attach", function (done) {
    console.log("🚸 [chai] POST /api/device/mesh/attach (JWT) 3");
    agent
      .post('/api/device/mesh/attach')
      .set('Authorization', jwt)
      .send({ mesh_id: mesh_id })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/mesh/attach (JWT) 3 response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/mesh/attach", function (done) {
    console.log("🚸 [chai] POST /api/device/mesh/attach (JWT) 4");
    agent
      .post('/api/device/mesh/attach')
      .set('Authorization', jwt)
      .send({ udid: envi.dynamic.udid, mesh_id: mesh_id })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/mesh/attach (JWT) 4 response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/mesh/detach", function (done) {
    console.log("🚸 [chai] POST /api/device/mesh/detach (noudid)");
    chai.request(thx.app)
      .post('/api/device/mesh/detach')
      .send({ mesh_id: mesh_id })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/mesh/detach (noudid) response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  // POST /api/device/mesh/detach
  it("POST /api/device/mesh/detach", function (done) {
    console.log("🚸 [chai] POST /api/device/mesh/detach (JWT)");
    agent
      .post('/api/device/mesh/detach')
      .set('Authorization', jwt)
      .send({ udid: envi.dynamic.udid, mesh_id: "device-mesh-id" })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/mesh/detach (JWT) response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/mesh/detach", function (done) {
    console.log("🚸 [chai] POST /api/device/mesh/detach (JWT) 2");
    agent
      .post('/api/device/mesh/detach')
      .set('Authorization', jwt)
      .send({ udid: JRS5.udid, mesh_id: "device-mesh-id" })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/mesh/detach (JWT) 2 response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/data", function (done) {
    console.log("🚸 [chai] POST /api/device/data (JWT)");
    agent
      .post('/api/device/data')
      .set('Authorization', jwt)
      .send({ udid: envi.oid })
      .end((err, res) => {
        console.log("🚸 [chai] response /api/device/data (JWT):", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/data", function (done) {
    console.log("🚸 [chai] POST /api/device/data (JWT) 2");
    agent
      .post('/api/device/data')
      .set('Authorization', jwt)
      .send({ udid: JRS5.udid })
      .end((err, res) => {
        console.log("🚸 [chai] response /api/device/data (JWT) 2:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/revoke", function (done) {
    console.log("🚸 [chai] POST /api/device/revoke (JWT)");
    agent
      .post('/api/device/revoke')
      .set('Authorization', jwt)
      .send({ udid: envi.oid })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/revoke (JWT) response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  //
  // Device Configuration
  //

  // push device configuration over MQTT
  it("POST /api/device/push", function (done) {
    console.log("🚸 [chai] POST /api/device/push (JWT)");
    agent
      .post('/api/device/push')
      .set('Authorization', jwt)
      .send({ key: "value" })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/push (JWT) response:", res.text, " status:", res.status);
        // no messenger, will fail here...
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  it("POST /api/device/revoke", function (done) {
    console.log("🚸 [chai] POST /api/device/revoke (JWT) 2");
    agent
      .post('/api/device/revoke')
      .set('Authorization', jwt)
      .send({ udid: JRS5.udid })
      .end((err, res) => {
        console.log("🚸 [chai] POST /api/device/revoke (JWT) 2 response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  //
  // API v2 specs for device.router.js
  //

  // GET /api/v2/device
  it("GET /api/v2/device (JWT)", function (done) {
    console.log("🚸 [chai] GET /api/v2/device (JWT)");
    agent
      .get('/api/v2/device')
      .set('Authorization', jwt)
      .end((err, res) => {
        console.log("🚸 [chai] GET /api/v2/device (JWT) response 1:", res.text, " status:", res.status);
        expect(res.status).to.equal(200);
        expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  // PUT /api/v2/device
  it("PUT /api/v2/device (JWT)", function (done) {
    console.log("🚸 [chai] PUT /api/v2/device (JWT)");
    agent
      .put('/api/v2/device')
      .set('Authorization', jwt)
      .send({ changes: { alias: "changed" }})
      .end((err, res) => {
        console.log("🚸 [chai] PUT /api/v2/device (JWT) response 2:", res.text, " status:", res.status);
        expect(res.status).to.equal(200);
        expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  // PUT /api/v2/source/attach
  it("PUT /api/v2/source/attach", function (done) {
    console.log("🚸 [chai] PUT /api/v2/source/attach (JWT)");
    agent
      .put('/api/v2/source/attach')
      .set('Authorization', jwt)
      .send({ udid: JRS5.udid })
      .end((err, res) => {
        console.log("🚸 [chai] PUT /api/v2/source/attach response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);
  
  // PUT /api/v2/source/detach
  it("PUT /api/v2/source/detach", function (done) {
    console.log("🚸 [chai] PUT /api/v2/source/detach (JWT)");
    agent
      .put('/api/v2/source/detach')
      .set('Authorization', jwt)
      .send({ udid: envi.oid })
      .end((err, res) => {
        console.log("🚸 [chai] PUT /api/v2/source/detach (JWT) response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  // PUT /api/v2/mesh/attach
  it("PUT /api/v2/mesh/attach", function (done) {
    console.log("🚸 [chai] PUT /api/v2/mesh/attach");
    agent
      .put('/api/v2/mesh/attach')
      .set('Authorization', jwt)
      .send({ udid: envi.dynamic.udid, mesh_id: mesh_id })
      .end((err, res) => {
        console.log("🚸 [chai] PUT /api/v2/mesh/attach response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  // PUT /api/v2/mesh/detach
  it("PUT /api/v2/mesh/detach", function (done) {
    console.log("🚸 [chai] PUT /api/v2/mesh/detach");
    agent
      .put('/api/v2/mesh/detach')
      .set('Authorization', jwt)
      .send({ udid: envi.dynamic.udid, mesh_id: "device-mesh-id" })
      .end((err, res) => {
        console.log("🚸 [chai] PUT /api/v2/mesh/detach response:", res.text, " status:", res.status);
        //expect(res.status).to.equal(200);
        //expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);

  // DELETE /api/v2/device
  it("DELETE /api/v2/device (JWT)", function (done) {
    console.log("🚸 [chai] GET /api/v2/device (JWT)");
    agent
      .delete('/api/v2/device')
      .send({})
      .set('Authorization', jwt)
      .end((err, res) => {
        console.log("🚸 [chai] GET /api/v2/device (JWT) response 3:", res.text, " status:", res.status);
        expect(res.status).to.equal(200);
        expect(res.text).to.be.a('string');
        done();
      });
  }, 20000);
});