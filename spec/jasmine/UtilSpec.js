/* Router integration test only; does not have to cover full unit functionality. */

var expect = require('chai').expect;

const Util = require("../../lib/thinx/util");

var envi = require("../_envi.json");

describe("Util", function () {

    beforeAll(() => {
        console.log(`🚸 [chai] >>> running Util spec`);
      });
    
      afterAll(() => {
        console.log(`🚸 [chai] <<< completed Util spec`);
      });
    
    it("should extract owner from request", function () {
        let req = {
            session: {
                owner: envi.dynamic.owner
            },
            body: {
                owner: envi.dynamic.owner
            }
        };
        req.session.destroy = () => {
            console.log(`🚸 [chai] validateSession destroy called (1)...`);
        };
        let result = Util.ownerFromRequest(req);
        expect(result).to.be.a('string');
    });

    it("should respond to request", function (done) {
        let res = { object: true };
        res.end = (body) => {
            expect(body).to.be.a('string');
            done();
        };
        res.header = (arg1, arg2) => {
            expect(arg1).to.equal('Content-Type');
            //expect(arg2).to.equal('text/plain; charset=utf-8');
        };
        Util.responder(res, true, "message");
    });

    it("should validate session with JWT request", function (/* done */) {
        let req = {
            headers: {
                'Authorization': envi.dynamic.owner
            },
            session: {
                owner: envi.dynamic.owner
            },
            body: {
                owner: envi.dynamic.owner
            }
        };
        req.session.destroy = () => {
            console.log(`🚸 [chai] validateSession destroy called (3)...`);
        };
        let result = Util.validateSession(req);
        expect(result).to.equal(true);
    });

    it("should validate session with session", function () {
        let req = {
            headers: { },
            session: {
                owner: envi.dynamic.owner
            },
            body: { }
        };
        req.session.destroy = () => {
            console.log(`🚸 [chai] validateSession destroy called (4)...`);
        };
        let result = Util.validateSession(req);
        expect(result).to.equal(true);
    });

    it("should invalidate session with invalid body", function (done) {
        let req = {
            headers: { },
            session: { },
            body: {
                owner: envi.dynamic.owner,
                api_key: envi.dynamic.api_key
            }
        };
        req.session.destroy = () => {
            console.log(`🚸 [chai] validateSession destroy called (5)...`);
            done();
        };
        let result = Util.validateSession(req);
        expect(result).to.equal(false);
    });

    it("should validate session with valid body", function () {
        let req = {
            headers: { },
            session: { },
            body: {
                owner_id: envi.oid,
                api_key: envi.ak
            }
        };
        req.session.destroy = () => {
            console.log(`🚸 [chai] validateSession destroy called (6)...`);
        };
        let result = Util.validateSession(req);
        expect(result).to.equal(true);
    });

    it("should respond with buffer", function (done) {
        let res = { object: true };
        res.end = (body) => {
            expect(typeof(body)).to.equal('object');
            done();
        };
        res.header = (arg1, arg2) => {
            expect(arg1).to.equal('Content-Type');
            expect(arg2).to.equal('application/octet-stream');
        };
        Util.respond(res, new Buffer("message"));
    });

    it("should support responder with buffer", function (done) {
        let res = { object: true };
        res.end = (body) => {
            expect(typeof(body)).to.equal('object');
            done();
        };
        res.header = (arg1, arg2) => {
            expect(arg1).to.equal('Content-Type');
            expect(arg2).to.equal('application/octet-stream');
        };
        Util.responder(res, true, new Buffer("message"));
    });

    it("should provide convenience method for undefined objects", function() {
        let i;
        expect(Util.isDefined(i)).to.equal(false);
        let j = null;
        expect(Util.isDefined(j)).to.equal(false);
        let k = "something";
        expect(Util.isDefined(k)).to.equal(true);
    });

    it("should should tell one is undefined", function() {
        let a = [
            "x",
            undefined,
            null,
            "y"
        ];
        expect(Util.isUndefinedOf(a)).to.equal(true);
    });

    it("should should tell none is undefined", function() {
        let a = [
            "x",
            "undefined",
            "y"
        ];
        expect(Util.isUndefinedOf(a)).to.equal(false);
    });
});