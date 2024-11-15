var envi = require("../_envi.json");

const Globals = require("../../lib/thinx/globals.js");
const redis_client = require('redis');

describe("Queue Action", function () {

    let redis;

    beforeAll(async () => {
        console.log(`🚸 [chai] >>> running Queue Action spec`);
        // Initialize Redis
        redis = redis_client.createClient(Globals.redis_options());
        await redis.connect();
    });

    afterAll(() => {
        console.log(`🚸 [chai] <<< completed Queue Action spec`);
    });

    var expect = require('chai').expect;

    var Action = require("../../lib/thinx/queue_action");

    let owner_id = envi.oid;
    let mock_udid_4 = "<mock-udid-4>";
    let mock_source_id = envi.sid;
    let action;
    let string_temp;

    // constructor(udid), starts redis client...
    it("should be able to Init with UDID", function () {
        action = new Action(mock_udid_4, redis);
        expect(action).to.be.a('object');
    });

    // queueWithSource
    it("should be able start queue with source", function (done) {
        action.queueWithSource(mock_source_id, owner_id, () => {
            done();
        });
    });

    // setStarted
    it("should be able change action state", function () {
        action.setStarted();
        let status = action.getStatus();
        expect(status).to.equal("running");
    });

    // toString can be called only after queueWithSource
    it("should be able return action as string", function () {
        string_temp = action.toString();
        expect(string_temp).to.be.a('string');
    });

    // withString
    it("should be able recreate action from string", function () {
        let action2 = new Action(null, redis);
        action2.withString(string_temp);
        let string_temp2 = action.toString();
        expect(string_temp).to.equal(string_temp2);
    });

    // isRunning
    it("should be able tell whether action is running", function (done) {
        action.queueWithSource(mock_source_id, owner_id, (result) => {
            console.log("[spec] tell whether action is running", result);
            done();
        });
    });

    // isWaiting
    it("should be able tell whether action is waiting", function (done) {
        action.queueWithSource(mock_source_id, owner_id, (result) => {
            console.log("[spec] tell whether action is waiting", result);
            done();
        });
    });

    // save
    it("should be able to save action", function () {
        action.save();
    });

    it("should be able report action state when running", function () {
        action.isRunning();
    });

    it("should be able report action state when waiting", function () {
        action.isWaiting();
    });

    it("should fail safely on invalid source", function () {
        delete action.source;
        action.toString();
    });

    // delete
    it("should be able to delete the action", function () {
        action.delete();
    });

});