const expect = require('chai').expect;
const Repository = require('../../lib/thinx/repository');
const Messenger = require('../../lib/thinx/messenger');

const Globals = require("../../lib/thinx/globals.js");
const redis_client = require('redis');

// tests are run from ROOT
let repo_path = __dirname;

describe("Repository", function() {

  let messenger = new Messenger("mosquitto").getInstance("mosquitto");
  let watcher;
  let redis;

  beforeAll(async() => {
    console.log(`🚸 [chai] >>> running Repository spec`);
    redis = redis_client.createClient(Globals.redis_options());
    await redis.connect();
    watcher = new Repository(messenger, redis, /* mock_queue */);
  });

  afterAll(() => {
    console.log(`🚸 [chai] <<< completed Repository spec`);
  });

  watcher.callback = function(err) {
    // watcher exit_callback
    console.log("Callback 1", err);
  };
  watcher.exit_callback = function(err) {
    // watcher exit_callback
    console.log("Callback 2", err);
  };

  console.log("✅ [spec] [info] Watcher is using repo_path: "+repo_path);

  it("should be able to find all repositories", function() {
    let result = Repository.findAllRepositoriesWithFullname("esp");
    expect(result).to.be.an('array');
  });

  it("should be able to find all repositories with search query", function() {
    let result = Repository.findAllRepositoriesWithFullname("esp8266");
    expect(result).to.be.an('array');
  });

  it("should be able to purge old repos", function() {
    watcher = new Repository(messenger, redis, queue);
    let name = "esp";
    let repositories = Repository.findAllRepositoriesWithFullname("esp8266");
    watcher.purge_old_repos_with_full_name(repositories, name);
    expect(watcher).to.be.an('object');
  });

  it("should be able to initialize", function() {
    watcher = new Repository(messenger, redis, /* mock_queue */);
    expect(watcher).to.be.an('object');
  });

  it("should be able to respond to githook", function() {
    watcher = new Repository(messenger, redis, /* mock_queue */);
    let mock_git_message = require("../mock-git-response.json");
    let mock_git_request = {
      headers: [],
      body: mock_git_message
    };
    let response = watcher.process_hook(mock_git_request);
    expect(response).to.be.false; // fix later
  });

  it("should be able to respond to githook (invalid)", function() {
    watcher = new Repository(messenger, redis, /* mock_queue */);
    let mock_git_message = require("../mock-git-response.json");
    let mock_git_request = {
      headers: [],
      body: mock_git_message
    };
    delete mock_git_request.body.repository;
    let response = watcher.process_hook(mock_git_request);
    expect(response).to.be.false; // fix later
  });

  it ("should be able to verify body signature", () => {
    let result = watcher.validateSignature("sha256=null", "{ body: false }", "secret");
    expect(result).to.be.false;
  });

});
