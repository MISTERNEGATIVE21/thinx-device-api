describe("Build log", function() {

  var expect = require('chai').expect;
  var BuildLog = require("../../lib/thinx/buildlog");
  var blog = new BuildLog();

  var envi = require("../_envi.json");
  var owner = envi.oid;
  var udid = envi.udid;
  var build_id = envi.build_id;

  /*
   * WebSocket Server
   */

  it("(01) should be able to initialize", function() {
    expect(blog).to.be.a('object');
  });

  it("(02) should be able to log", function(done) {
    blog.log(build_id, owner, udid, "Testing build log create...", function(error, body) {
      console.log("(02) error and body", {error}, {body});
      done();
    });
  });

  it("(03) should be able to append existing log", function(done) {
    blog.log(build_id, owner, udid, "Testing build log append...", function(error, body) {
      console.log("(02) error and body", {error}, {body});
      done();
    });
  });

  it("(04) should be able to list build logs", function(done) {
    blog.list(owner, function(err, body) {
      console.log("[spec] [info] build_logs", body);
      // err should be null
      expect(body).to.be.an('object'); // { rows: [] } in case of empty; ahways has dows
      var last_build_id = body.rows[0];
      console.log("(02) last_build_id", JSON.stringify(last_build_id), "should not be null or undefined! build instead of mocking. That's why this suite starts with X");
      if ((typeof(last_build_id) !== "undefined") && (last_build_id !== null)) {
        blog.fetch(last_build_id, function(berr, bbody) {
          console.log("[spec] [info] fetched log body:", bbody);
          expect(berr).to.equal(false);
          done();
        });
      }
      done();
    });
  }, 15000);

  it("(05) should be able to tail log for build_id", function() {
    const no_socket = null;
    blog.logtail(build_id, require("../_envi.json").oid, no_socket, function(success) {
        if (success !== true) {
          console.log(success); // error reason
        }
        expect(success).to.be.true;
      });
  });

  it("(05) should provide path for device", function() {
    var path = blog.pathForDevice(owner, udid);
    // e.g. /mnt/data/data/07cef9718edaad79b3974251bb5ef4aedca58703142e8c4c48c20f96cda4979c/d6ff2bb0-df34-11e7-b351-eb37822aa172
    // lastItem == typeof UDID
    // lastItem-1 == typeof OWNER
    expect(path).to.be.a('string');
  });

});
