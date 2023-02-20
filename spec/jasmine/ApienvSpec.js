let Globals = require('../../lib/thinx/globals');
const redis_client = require('redis');
const APIEnv = require('../../lib/thinx/apienv');

var expect = require('chai').expect;
var envi = require("../_envi.json");
var owner = envi.oid;

describe("API Env", function () {

  let redis;
  let apienv;

  beforeAll(async () => {
    console.log(`🚸 [chai] >>> running APIEnv spec`);
    // Initialize Redis
    redis = redis_client.createClient(Globals.redis_options());
    await redis.connect();
    apienv = new APIEnv(redis);
  });

  afterAll(() => {
    console.log(`🚸 [chai] <<< completed APIEnv spec`);
  });

  // create: function(owner, name, value, callback)
  it("should be able to store new environment variable", function (done) {
    apienv.create(
      owner,
      "sample-var-name",
      "sample-var-value",
      (success, object) => {
        expect(object).to.be.a('string');
        if (success) {
          done();
        }
      });
  }, 30000);

  it("should be able to add environment variable", function (done) {
    apienv.create(
      owner,
      "sample-var-name-2",
      "sample-var-value-2",
      (success, object) => {
        expect(object).to.be.a('string');
        expect(success).to.equal(true);
        expect(object).to.equal('sample-var-name-2');
        done();
      });
  }, 30000);

  it("should be able to store completely new environment variable", function (done) {
    apienv.create(
      "nonexistent-owner",
      "sample-var-name",
      "sample-var-value",
      function (success, object) {
        expect(object).to.be.a('string');
        expect(object).to.equal('sample-var-name');
        if (success) {
          done();
        }
      });
  }, 30000);

  it("should be able to fetch specific env var", function (done) {
    apienv.fetch(
      owner,
      "sample-var-name",
      function (success, response) {
        expect(success).to.equal(true);
        expect(response).to.be.an('object');
        done();
      });
  }, 3000);



  // list: function(owner, callback)
  it("should be able to list environment variables", function (done) {
    apienv.list(
      owner,
      function (success, object) {
        expect(success).to.equal(true);
        expect(object).to.be.an('array');
        done();
      });
  }, 5000);

  it("should fail safely for invalid owner in list", function (done) {
    apienv.list(
      "invalid-owner",
      function (success, object) {
        expect(success).to.equal(true);
        expect(object).to.be.an('array');
        expect(object.length).to.equal(0);
        done();
      });
  }, 5000);

  it("should be able to revoke environment variables",
    function (done) {
      const changes = [
        "sample-var-name"
      ];
      apienv.revoke(
        owner,
        changes,
        function (success, object) {
          expect(success).to.equal(true);
          expect(object["sample-var-name"]).to.equal("deleted");
          done();
        });
    }, 5000);

  // revoke: function(owner, name, callback)
  it("should be able to fail on invalid env var revocation", function (done) {
    const changes = [
      "invalid-var-name"
    ];
    apienv.revoke(
      owner,
      changes,
      function (success) {
        expect(success).to.equal(false);
        done();
      });
  }, 5000);

  it("should be able survive invalid input", function (done) {
    apienv.fetch(
      undefined,
      "sample-var-name",
      function (success, response) {
        expect(success).to.equal(false);
        expect(response).to.be.a('string'); // key_not_found
        done();
      });
  }, 3000);

});
