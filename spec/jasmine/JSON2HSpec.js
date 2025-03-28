const JSON2H = require("../../lib/thinx/json2h");
const expect = require('chai').expect;  

let mock_json_template = {
    "COMMENT_0a": " ",
    "COMMENT_0b": "This is autogenerated %%LANGUAGE_NAME%% header",
    "COMMENT_0c": " ",
    "THINX_ALIAS": "robodyn-d1-mini",
    "THINX_OWNER": "cedc16bb6bb06daaa3ff6d30666d91aacd6e3efbf9abbc151b4dcade59af7c12",
    "THINX_API_KEY": "88eb20839c1d8bf43819818b75a25cef3244c28e77817386b7b73b043193cef4",
    "THINX_COMMIT_ID": "269c6fa21cf7e02d7db098b1fc20d14b9c8ce600",
    "THINX_FIRMWARE_VERSION_SHORT": "1.6.92",
    "THINX_FIRMWARE_VERSION": "thinx-firmware-esp8266-1.6.92:2017-06-25",
    "THINX_UDID": "f8e88e40-43c8-11e7-9ad3-b7281c2b9610",
    "THINX_APP_VERSION": "1.0.0",
    "THINX_CLOUD_URL": "staging.thinx.cloud",
    "THINX_MQTT_URL": "staging.thinx.cloud",
    "THINX_AUTO_UPDATE": true,
    "THINX_MQTT_PORT": 1883,
    "THINX_API_PORT": 7442,
    "THINX_PROXY": "thinx.local",
    "THINX_PLATFORM": "%%THINX_PLATFORM%%"
  };

describe("API Key", function() {

  beforeAll(() => {
    console.log(`🚸 [chai] >>> running JSON2H Key spec`);
  });

  afterAll(() => {
    console.log(`🚸 [chai] <<< completed JSON2H Key spec`);
  });

   //list: function(invalid-owner, callback)
   it("should be able to convert JSON file to header", function () {
       let opts = {
        LANGUAGE_NAME: "C",
        THINX_PLATFORM: "arduino"
       };
       let result = JSON2H.process(mock_json_template, opts);
       let c_header = (result.indexOf(`#define COMMENT_0b="This is autogenerated C header"`) !== -1);
       let arduino_platform = (result.indexOf(`#define THINX_PLATFORM="arduino"`) !== -1);
       expect(c_header);
       expect(arduino_platform);
       console.log(result);
  });

});
