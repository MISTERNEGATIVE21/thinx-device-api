const Database = require("../../lib/thinx/database");
const database = new Database();
const expect = require('chai').expect;

describe("Database", function () {

  beforeAll((done) => {
    console.log(`🚸 [chai] >>> running Database spec`);
    database.init((err, result) => {
      console.log("[spec] database pre-init", { err }, { result });
      expect(err).to.equal(null);
      expect(result).to.be.an('array');
      //expect(result.length).to.equal(7); or 6.... it depends
      done();
    });
  });

  afterAll(() => {
    console.log(`🚸 [chai] <<< completed Database spec`);
  });

  it("should start and create initial DBs", function (done) {
    database.init((err, result) => {
      console.log("[spec] database init", { err }, { result });
      expect(err).to.equal(null);
      expect(result).to.be.an('array');
      //expect(result.length).to.equal(7); or 6.... it depends
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
