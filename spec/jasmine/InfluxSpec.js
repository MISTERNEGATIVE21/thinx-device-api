const InfluxConnector = require('../../lib/thinx/influx');

describe("InfluxDB", function () {

    /*

    static get_owner_template() {
        // Defines data model and also lists known tracked keys
        return {
            APIKEY_INVALID: [0],
            LOGIN_INVALID: [0],
            APIKEY_MISUSE: [0],
            APIKEY_REVOKED: [0],
            DEVICE_NEW: [0],
            DEVICE_CHECKIN: [0],
            DEVICE_UPDATE_OK: [0], // TODO (22): not implemented
            DEVICE_UPDATE_FAIL: [0], // TODO (22): not implemented
            DEVICE_REVOCATION: [0],
            BUILD_STARTED: [0],
            BUILD_SUCCESS: [0],
            BUILD_FAIL: [0]
        };
    }

    */

    it("should write with owner_id without udid", function (done) {
        let point = {
            measurement: 'LOGIN_INVALID',
            tags: { owner_id: "test" },
            fields: { value: 1.0 },
        }
        InfluxConnector.write(point, (result) => {
            console.log("InfluxDB result", result);
            done();
        });
    });

    it("should write with owner_id and udid", function (done) {
        let point = {
            measurement: 'CHECKIN',
            tags: { owner_id: "test", udid: "udid" },
            fields: { value: 1 },
        }
        InfluxConnector.write(point, (result) => {
            console.log("InfluxDB result", result);
            done();
        });
    });
});