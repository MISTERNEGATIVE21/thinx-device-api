/* Router integration test only; does not have to cover full unit functionality. */

const THiNX = require("../../thinx-core.js");

let chai = require('chai');
var expect = require('chai').expect;
let chaiHttp = require('chai-http');
chai.use(chaiHttp);

var envi = require("../_envi.json");

const dynamic_owner_id = envi.dynamic.owner;


//
// Unauthenticated
//

let thx;

describe("Builder (noauth)", function () {

    beforeAll((done) => {
        console.log(`🚸 [chai] >>> running Builder (noauth) spec`);
        thx = new THiNX();
        thx.on('workerReady', () => {
            console.log("🚸🚸🚸 [spec] [emit] worker ready! 🚸🚸🚸"); // should allow waiting for worker beforeAll
            done();
        });
        thx.init(() => {
            done();
        });
    }, 30000);

    // run build manually
    it("POST /api/build", function (done) {
        chai.request(thx.app)
            .post('/api/build')
            .send({})
            .end((err, res) => {
                console.log("🚸 [chai] response /api/build:", res.text, " status:", res.status);
                expect(res.status).to.equal(401);
                //expect(res.text).to.be.a('string');
                done();
            });
    }, 30000);

    // latest firmware envelope
    it("POST /api/device/envelope", function (done) {
        chai.request(thx.app)
            .post('/api/device/envelope')
            .send({})
            .end((err, res) => {
                console.log("🚸 [chai] response /api/device/envelope:", res.text, " status:", res.status);
                expect(res.status).to.equal(200);
                expect(res.text).to.be.a('string'); // false
                done();
            });
    }, 30000);

    // get build artifacts
    it("POST /api/device/artifacts", function (done) {
        chai.request(thx.app)
            .post('/api/device/artifacts')
            .send({})
            .end((err, res) => {
                console.log("🚸 [chai] response /api/device/artifacts:", res.text, " status:", res.status);
                expect(res.status).to.equal(401);
                done();
            });
    }, 30000);

    afterAll(() => {
        console.log(`🚸 [chai] <<< completed Builder (noauth) spec`);
      });

});

//
// Authenticated
//

describe("Builder (JWT)", function () {

    let agent;
    let jwt;

    beforeAll((done) => {
        agent = chai.request.agent(thx.app);
        console.log(`🚸 [chai] Builder (JWT) spec`);
        agent
            .post('/api/login')
            .send({ username: 'dynamic', password: 'dynamic', remember: false })
            .then(function (res) {
                console.log(`[chai] beforeAll POST /api/login (valid) response: ${res}`);
                expect(res).to.have.cookie('x-thx-core');
                let body = JSON.parse(res.text);
                jwt = 'Bearer ' + body.access_token;
                done();
            })
            .catch((e) => { console.log(e); });
    });

    afterAll((done) => {
        agent.close();
        console.log(`🚸 [chai] <<< completed Builder (JWT) spec`);
        done();
    });

    // run build manually
    it("POST /api/build (JWT, invalid) I", function (done) {
        agent
            .post('/api/build')
            .set('Authorization', jwt)
            .send({})
            .end((err, res) => {
                expect(res.status).to.equal(400);
                done();
            });
    }, 30000);
    
    // covering buildGuards

    it("POST /api/build (JWT, invalid) II", function (done) {
        agent
            .post('/api/build')
            .set('Authorization', jwt)
            .send({ owner: dynamic_owner_id, git: "something", branch: "origin/master" })
            .end((err, res) => {
                expect(res.status).to.equal(400);
                done();
            });
    }, 30000);

    it("POST /api/build (JWT, invalid) III", function (done) {
        agent
            .post('/api/build')
            .set('Authorization', jwt)
            .send({ git: "something", branch: "origin/master" })
            .end((err, res) => {
                expect(res.status).to.equal(400);
                done();
            });
    }, 30000);

    it("POST /api/build (JWT, invalid) IV", function (done) {
        agent
            .post('/api/build')
            .set('Authorization', jwt)
            .send({ owner: dynamic_owner_id, branch: "origin/master" })
            .end((err, res) => {
                expect(res.status).to.equal(400);
                done();
            });
    }, 30000);

    it("POST /api/build (JWT, invalid) V", function (done) {
        agent
            .post('/api/build')
            .set('Authorization', jwt)
            .send({ owner: dynamic_owner_id, git: "origin/master" })
            .end((err, res) => {
                expect(res.status).to.equal(400);
                done();
            });
    }, 30000);

    it("POST /api/build (JWT, invalid) VI", function (done) {
        agent
            .post('/api/build')
            .set('Authorization', jwt)
            .send({ owner: dynamic_owner_id, git: "origin/master", udid: null })
            .end((err, res) => {
                expect(res.status).to.equal(400);
                done();
            });
    }, 30000);

    it("POST /api/build (JWT, invalid) VII", function (done) {
        agent
            .post('/api/build')
            .set('Authorization', jwt)
            .send({ owner: dynamic_owner_id, git: "origin/master", source_id: null })
            .end((err, res) => {
                expect(res.status).to.equal(400);
                done();
            });
    }, 30000);

    it("POST /api/build (JWT, valid) VI", function (done) {

        agent
            .post('/api/device/attach')
            .set('Authorization', jwt)
            .send({ 
                udid: envi.dynamic.udid, 
                source_id: "7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f4" 
            })
            .end((err, res) => {
                console.log("🚸 [chai] POST /api/device/attach response:", res.text, " status:", res.status);
                //expect(res.status).to.equal(200);
                //expect(res.text).to.be.a('string');

                agent
                    .post('/api/build')
                    .set('Authorization', jwt)
                    .send({
                        owner: dynamic_owner_id,
                        git: "https://github.com/suculent/thinx-firmware-esp8266-pio",
                        branch: "origin/master",
                        udid: envi.dynamic.udid,
                        source_id: "7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f4",
                        build_id: envi.dynamic.udid
                    })
                    .end((err, res) => {
                        console.log("🚸 [chai] response /api/build (JWT, invalid) V:", res.text, " status:", res.status);
                        expect(res.status).to.equal(400);
                        //expect(res.text).to.be.a('string');
                        done();
                    });
            });

        
    }, 30000);

    it("POST /api/v2/build (JWT, valid) V", function (done) {

        agent
            .post('/api/device/attach')
            .set('Authorization', jwt)
            .send({ 
                udid: envi.dynamic.udid, 
                source_id: "7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f4" 
            })
            .end((_err, res) => {
                expect(res.status).to.equal(200);
                expect(res.text).to.be.a('string');

                agent
                    .post('/api/v2/build')
                    .set('Authorization', jwt)
                    .send({ build: {
                            owner: dynamic_owner_id,
                            git: "https://github.com/suculent/thinx-firmware-esp8266-pio",
                            branch: "origin/master",
                            udid: envi.dynamic.udid,
                            source_id: "7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f4",
                            build: envi.dynamic.udid
                        }
                    })
                    .end((err, res) => {
                        expect(res.status).to.equal(200);
                        expect(res.text).to.equal('{"success":true,"response":"queued"}');
                        done();
                    });
            });

        
    }, 30000);

    // latest firmware envelope
    it("POST /api/device/envelope (JWT, invalid)", function (done) {
        agent
            .post('/api/device/envelope')
            .set('Authorization', jwt)
            .send({})
            .end((err, res) => {
                expect(res.status).to.equal(200);
                expect(res.text).to.be.a('string');
                expect(res.text).to.equal('{}');
                done();
            });
    }, 30000);

    it("POST /api/v2/device/lastbuild (JWT, invalid)", function (done) {
        agent
            .post('/api/v2/device/lastbuild')
            .set('Authorization', jwt)
            .send({})
            .end((err, res) => {
                expect(res.status).to.equal(200);
                expect(res.text).to.be.a('string');
                expect(res.text).to.equal('{}');
                done();
            });
    }, 30000);

    // get build artifacts
    it("POST /api/device/artifacts (JWT, invalid)", function (done) {
        agent
            .post('/api/device/artifacts')
            .set('Authorization', jwt)
            .send({})
            .end((err, res) => {
                console.log("🚸 [chai] response /api/device/artifacts (JWT, invalid):", res.text, " status:", res.status);
                expect(res.status).to.equal(200);
                expect(res.text).to.be.a('string');
                expect(res.text).to.equal('{"success":false,"response":"missing_owner"}');
                done();
            });
    }, 30000);

    it("POST /api/device/artifacts (JWT, semi-valid 1)", function (done) {
        agent
            .post('/api/device/artifacts')
            .set('Authorization', jwt)
            .send({ udid: envi.dynamic.udid })
            .end((err, res) => {
                console.log("🚸 [chai] POST /api/device/artifacts (JWT, semi-valid 1) response:", res.text, " status:", res.status);
                expect(res.status).to.equal(200);
                expect(res.text).to.be.a('string');
                expect(res.text).to.equal('{"success":false,"response":"missing_owner"}');
                done();
            });
    }, 30000);

    it("POST /api/device/artifacts (JWT, semi-valid 2)", function (done) {
        agent
            .post('/api/device/artifacts')
            .set('Authorization', jwt)
            .send({ build_id: envi.dynamic.udid })
            .end((err, res) => {
                console.log("🚸 [chai] POST /api/device/artifacts (JWT, semi-valid 2) response:", res.text, " status:", res.status);
                expect(res.status).to.equal(200);
                expect(res.text).to.be.a('string');
                expect(res.text).to.equal('{"success":false,"response":"missing_owner"}');
                done();
            });
    }, 30000);

    it("POST /api/device/artifacts (JWT, semi-valid 3)", function (done) {
        //console.log("🚸 [chai] POST /api/device/artifacts (JWT, semi-valid)");
        agent
            .post('/api/device/artifacts')
            .set('Authorization', jwt)
            .send({ udid: envi.dynamic.udid, build_id: envi.dynamic.udid  })
            .end((err, res) => {
                console.log("🚸 [chai] POST /api/device/artifacts (JWT, semi-valid 3) response:", res.text, " status:", res.status);
                expect(res.status).to.equal(200);
                expect(res.text).to.be.a('string');
                expect(res.text).to.equal('{"success":false,"response":"missing_owner"}');
                done();
            });
    }, 30000);

    it("POST /api/v2/build/artifacts (JWT, semi-valid 4)", function (done) {
        //console.log("🚸 [chai] POST /api/build/artifacts (JWT, semi-valid)");
        agent
            .post('/api/v2/build/artifacts')
            .set('Authorization', jwt)
            .send({ udid: envi.dynamic.udid, build_id: envi.dynamic.udid  })
            .end((err, res) => {
                console.log("🚸 [chai] POST /api/device/artifacts (JWT, semi-valid 4) response:", res.text, " status:", res.status);
                expect(res.status).to.equal(200);
                expect(res.text).to.be.a('string');
                expect(res.text).to.equal('{"success":false,"response":"missing_owner"}');
                done();
            });
    }, 30000);

    it("POST /api/v2/build/artifacts (JWT, still-invalid)", function (done) {
        console.log("🚸 [chai] POST /api/build/artifacts (JWT, should-be-valid)");
        agent
            .post('/api/v2/build/artifacts')
            .set('Authorization', jwt)
            .send({ udid: envi.dynamic.udid, build_id: envi.dynamic.owner, owner: envi.dynamic.owner  })
            .end((err, res) => {
                console.log("🚸 [chai] response /api/v2/build/artifacts (JWT, still-invalid):", res.text, " status:", res.status);
                expect(res.status).to.equal(200);
                done();
            });
    }, 30000);

    // the artifact is mocked at mnt/data/deploy/<owner-id>/<udid>/<build_id>/<build_id>.zip
    it("POST /api/v2/build/artifacts (JWT, no-udid)", function (done) {
        console.log("🚸 [chai] POST /api/build/artifacts (JWT, no-udid)");
        agent
            .post('/api/v2/build/artifacts')
            .set('Authorization', jwt)
            .send({ build_id: envi.build_id, owner: envi.dynamic.owner  })
            .end((err, res) => {
                console.log("🚸 [chai] response /api/v2/build/artifacts (JWT, no-udid):", res.text, " status:", res.status);
                expect(res.status).to.equal(200);
                done();
            });
    }, 30000);

    it("POST /api/v2/build/artifacts (JWT, no-owner)", function (done) {
        console.log("🚸 [chai] POST /api/build/artifacts (JWT, no-owner)");
        agent
            .post('/api/v2/build/artifacts')
            .set('Authorization', jwt)
            .send({ udid: envi.dynamic.udid, build_id: envi.build_id  })
            .end((err, res) => {
                console.log("🚸 [chai] response /api/v2/build/artifacts (JWT, no-owner):", res.text, " status:", res.status);
                expect(res.status).to.equal(200);
                done();
            });
    }, 30000);

    // the artifact is mocked at mnt/data/deploy/<owner-id>/<udid>/<build_id>/<build_id>.zip
    it("POST /api/v2/build/artifacts (JWT, valid)", function (done) {
        console.log("🚸 [chai] POST /api/build/artifacts (JWT, should-be-valid)");
        agent
            .post('/api/v2/build/artifacts')
            .set('Authorization', jwt)
            .send({ udid: envi.dynamic.udid, build_id: envi.build_id, owner: envi.dynamic.owner  })
            .end((err, res) => {
                console.log("🚸 [chai] response /api/v2/build/artifacts (JWT, should-be-valid):", res.text, " status:", res.status);
                expect(res.status).to.equal(200);
                done();
            });
    }, 30000);

});