var APIKey = require("../../lib/thinx/apikey");
var expect = require('chai').expect;  
var generated_key_hash = null;
var sha256 = require("sha256");
var envi = require("../_envi.json");
var owner = envi.oid;
var apikey = new APIKey();

describe("API Key", function() {

   //list: function(invalid-owner, callback)
   it("(00) should be able to list empty API Keys", function (done) {
    apikey.list(
      "dummy",
      (success, object) => {
        expect(success).to.equal(false);
        if (success) {
          expect(object).to.be.a('array');
        } else {
          console.log("[spec] (06) API Key Listing failed:", {object});
        }
        if (done) done();
      });
  });

  //create: function(owner, apikey_alias, callback)
  it("(01) should be able to generate new API Key", function(done) {
    apikey.create(
      owner,
      "sample-key",
      (success, array_or_error) => {
        if (success) {
          generated_key_hash = sha256(array_or_error[0].key);
        } else {
          console.log("[spec] APIKey failed: ",{array_or_error});
        }
        expect(success).to.equal(true);
        expect(array_or_error[0].key).to.be.a('string');
        done();
      }
    );
  });

  it("(02) should be able to list API Keys", function(done) {
    apikey.list(
      owner,
      (success, object) => {
        if (success) {
          expect(object).to.be.a('array');
        } else {
          console.log("[spec] API Key Listing failed:", {object}, {success});
        }
        done();
      });
  });

  //verify: function(owner, apikey, callback)
  it("(03) should be able to verify invalid API Keys", function(done) {
    apikey.verify(
      owner,
      "invalid-api-key",
      true,
      (success /*, result */) => { // fixed (callback is not a function!)
        expect(success).to.equal(false);
        done();
      });
  });

  //revoke: function(owner, apikey_hash, callback)
  it("04 - should be able to revoke API Keys", function(done) {
    apikey.create(
      owner,
      "sample-key",
      (success, array_or_error) => {
        if (success) {
          generated_key_hash = sha256(array_or_error[0].key);
        } else {
          console.log("[spec] APIKey failed: ",{array_or_error});
        }
        expect(success).to.equal(true);
        expect(array_or_error[0].key).to.be.a('string');
        apikey.revoke(
          owner,
          [generated_key_hash],
          (_success, /* result */) => {
            expect(_success).to.equal(true);
            done();
          });
      }
    );
  });

  it("(05) should be able to fail on invalid API Key revocation (callback is not a function!)", function(done) {
    apikey.revoke(
      "nonsense",
      ["sample-key-hash"],
      (success)  => {
        expect(success).to.equal(false);
        done();
      }
    );
  });

  //list: function(owner, callback)
  it("(06) should be able to list API Keys (2)", function (done) {
    apikey.list(
      owner,
      (success, object) => {
        expect(success).to.equal(true);
        if (success) {
          expect(object).to.be.a('array');
        } else {
          console.log("[spec] (06) API Key Listing failed:", {object});
        }
        if (done) done();
      });
  });

  it("(07) should be able to get first API Key", function (done) {
    apikey.get_first_apikey(
      owner,
      (success, object) => {
        expect(success).to.equal(true);
        if (success) {
          expect(object).to.be.a('string');
        } else {
          console.log("[spec] (07) API Key Listing failed:", {object});
        }
        done();
      });
  });

});
