const Builder = require("../../lib/thinx/builder");
const Device = require("../../lib/thinx/device");
const Devices = require("../../lib/thinx/devices");
const Queue = require("../../lib/thinx/queue");

const expect = require('chai').expect;

const Notifier = require('../../lib/thinx/notifier');
const Messenger = require('../../lib/thinx/messenger');

const Globals = require("../../lib/thinx/globals.js");
const redis_client = require('redis');

describe("Builder", function () {

  let redis;
  let builder;
  let devices;
  let device;
  let queue;
  let messenger;

  let express = require("express");
  let app = express();
  app.disable('x-powered-by');

  beforeAll(async() => {
    console.log(`🚸 [chai] >>> running Builder spec`);
    // Initialize Redis
    redis = redis_client.createClient(Globals.redis_options());
    await redis.connect();
    builder = new Builder(redis);
    devices = new Devices(messenger, redis);
    device = new Device(redis);
    queue = new Queue(redis, builder, app, null, null);
    messenger = new Messenger(redis, "mosquitto").getInstance(redis, "mosquitto");
  });

  afterAll(() => {
    console.log(`🚸 [chai] <<< completed Builder spec`);
  });

  const envi = require("../_envi.json");
  let owner = envi.oid;
  let udid = envi.udid;
  let build_id = envi.build_id; // "f168def0-597f-11e7-a932-014d5b00c004";
  let source_id = envi.sid;
  let ak = envi.ak;

  let spec_build_id = null;

  // This UDID is to be deleted at the end of test.
  let TEST_DEVICE_5 = {
    mac: "AA:BB:CC:EE:00:05",
    firmware: "BuilderSpec.js",
    version: "1.0.0",
    checksum: "alevim",
    push: "forget",
    alias: "virtual-test-device-5-build",
    owner: "07cef9718edaad79b3974251bb5ef4aedca58703142e8c4c48c20f96cda4979c",
    platform: "platformio"
  };

  it("should be able to initialize", function () {
    expect(builder).to.be.a('object');
  });

  it("should be able to dry-run", function (done) {
    const build = {
      udid: udid,
      source_id: source_id,
      dryrun: true
    };
    builder.build(
      owner,
      build,
      [], // notifiers
      function (success, message, xbuild_id) {
        console.log("[spec] build dry", { success }, { message }, { xbuild_id });
        done();
      }, // callback
      queue.nextAvailableWorker()
    );
  }, 120000);

  // TODO: Source_id must be attached to device; or the notifier fails
  it("should be able to run", function (done) {
    let build = {
      udid: udid,
      source_id: source_id,
      dryrun: false
    };
    builder.build(
      owner,
      build,
      [], // notifiers
      function (success, message) {
        console.log("[spec] build dry", { success }, { message });
        //expect(message.build_id).to.exist;
        // TODO: loop and wait until build completes, check using build log...

        done();
      }, // callback
      queue.nextAvailableWorker()
    );
  }, 120000);

  it("supports certain languages", function () {
    let languages = builder.supportedLanguages();
    expect(languages).to.be.a('array');
  });

  it("supports certain extensions", function () {
    let extensions = builder.supportedExtensions();
    expect(extensions).to.be.a('array');
  });

  it("requires to register sample build device and attach source", function (done) {
    let res = {};
    device.register(
      TEST_DEVICE_5, /* reg.registration */
      ak,
      res,
      (r, success, response) => {
        if (success === false) {
          console.log("(01) registration response", response);
          expect(response).to.be.a('string');
          if (response === "owner_found_but_no_key") {
            done();
            return;
          }
        }
        TEST_DEVICE_5.udid = response.registration.udid;
        expect(success).to.equal(true);
        expect(TEST_DEVICE_5).to.be.an('object');
        expect(response.registration).to.be.an('object');
        expect(TEST_DEVICE_5.udid).to.be.a('string');

        let attach_body = {
          udid: TEST_DEVICE_5.udid,
          source_id: source_id
        };

        let res = { mock: true };

        devices.attach(TEST_DEVICE_5.owner, attach_body, (res, error, body) => {
          console.log("[spec] attach result", {res}, {error}, {body});
          done();
        }, res);

        
      });
  }, 15000); // register

  it("should not fail on build", function (done) {

    let build_request = {
      worker: queue.getWorkers()[0],
      build_id: build_id,
      owner: owner,
      git: "https://github.com/suculent/thinx-firmware-esp8266-pio.git",
      branch: "origin/master",
      udid: TEST_DEVICE_5.udid // expected to exist – may need to fetch details
    };

    let transmit_key = "";
    builder.run_build(build_request, [] /* notifiers */, (success, result) => {
      expect(success).to.equal(true);

      console.log("[spec] run_build result:", {result});
      spec_build_id = result.build_id;
      // result contains build_id for notification...

      let test_build_id = spec_build_id;
      let test_commit_id = "mock_commit_id";
      let test_repo = "https://github.com/suculent/thinx-firmware-esp8266-pio.git";
      let test_binary = "/tmp/nothing.bin";
      let test_udid = TEST_DEVICE_5.udid;
      let sha = "one-sha-256-pls";
      let owner_id = envi.oid;
      let status = "OK";
      let platform = "platformio";
      let version = "thinx-firmware-version-1.0";

      let job_status = {
        build_id: test_build_id,
        commit: test_commit_id,
        thx_version: "1.5.X",
        git_repo: test_repo,
        outfile: test_binary,
        udid: test_udid,
        sha: sha,
        owner: owner_id,
        status: status,
        platform: platform,
        version: version,
        md5: "md5-mock-hash",
        env_hash: "cafebabe"
      };

      let notifier = new Notifier();

      notifier.process(job_status, (result) => {
        console.log("[spec] Notifier's Processing result:", result);
        // keeps hanging when done(); here...
      });

      done();
      
    }, transmit_key);
  }, 30000);

  it("should fetch last apikey", function (done) {
    builder.getLastAPIKey("nonexistent", function (success/* , result */) {
      expect(success).to.equal(false);
      done();
    });
  }, 10000);

});
