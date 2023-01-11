var Database = require("../../lib/thinx/database");
var database = new Database();
var expect = require('chai').expect;

describe("Database", function () {

  beforeAll(() => {
    console.log(`🚸 [chai] >>> running Database spec`);
  });

  afterAll(() => {
    console.log(`🚸 [chai] <<< completed Database spec`);
  });

  it("should start and create initial DBs", function (done) {
    database.init((err, result) => {
        console.log("[spec] database init", {err}, {result});
        expect(err).to.equal(null);
        expect(result).to.be.an('array');
        expect(result.length).to.equal(6);
      done();
    });
  }, 5000);

  it("should run compactor", function (done) {
    database.init((/* err, result */) => {
      database.compactDatabases((/* success */) => {
        done();
      });
    });
  }, 10000);

  it("should provide global URI", function (done) {
    database.init((/* err, result */) => {
      let uri = database.uri();
      expect(uri);
      done();
    });
  }, 10000);

});
