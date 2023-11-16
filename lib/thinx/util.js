// Shared Router Methods

const Sanitka = require("./sanitka"); var sanitka = new Sanitka();
const typeOf = require("typeof");
module.exports = class Util {

  ///////////////////////////////////////////////////////////////////////
  //
  // DEVICE ROUTES
  //

  static ownerFromRequest(req) {
    let owner = req.session.owner;
    if ((typeof (owner) === "undefined") || (owner === null)) owner = req.body.owner;
    return sanitka.owner(owner);
  }

  static responder(res, success, message) {

    // send buffers (files) as octet-stream
    if (typeOf(message) == "buffer") {
      if (typeof (res.header) === "function") res.header("Content-Type", "application/octet-stream");
      return res.end(message);
    }
    
    // send strings as json messages
    if (typeOf(message) == "string") {
      if (typeof (res.header) === "function") res.header("Content-Type", "application/json; charset=utf-8");
      let response;
      try {
          response = JSON.stringify({
          success: success,
          response: message
        });
      } catch (e) {
        return JSON.stringify({ success: false, response: "serialization_failed" });
      }
      return res.end(response);
    }

    // message is an object, circular structures will fail...
    if (typeof (res.header) === "function") res.header("Content-Type", "application/json; charset=utf-8");
    let response;
    try {
        response = JSON.stringify({
        success: success,
        response: message
      });
    } catch (e) {
      console.log("[CRITICAL] issue while serializing message:", message);
      return JSON.stringify({ success: false, response: "request_failed" });
    }
    return res.end(response);
  }

  static validateSession(req) {

    // OK if request has JWT authorization (was already checked in app.all("/*"))
    if ((typeof (req.headers.authorization) !== "undefined") || (typeof (req.headers.Authorization) !== "undefined")) {
      return true;
      /*
      if (Object.keys(req.headers).length > 0) {
        return true;
      }
      */
    }

    // OK if request session has internally set owner
    if (typeof (req.session) !== "undefined") {
      return true;
      /*
      if (Object.keys(req.session).length > 0) {
        return true;
      }
      */
    }

    // OK if request has owner_id and api_key that has been previously validated
    if (typeof (req.body) !== "undefined") {
      if ((typeof (req.body.owner_id) !== "undefined") && (typeof (req.body.api_key) !== "undefined")) {
        return true;
      }
    }

    console.log("[debug] will destroy invalid session", {req});

    req.session.destroy();

    // No session, no API-Key auth, rejecting...
    return false;
  }

  static failureResponse(res, code, reason) {
    res.status(code);
    Util.responder(res, false, reason);
  }

  static respond(res, object) {
    if (typeOf(object) == "buffer") {
      res.header("Content-Type", "application/octet-stream");
      res.end(object);
    } else if (typeOf(object) == "string") {
      res.end(object);
    } else {
      res.end(JSON.stringify(object));
    }
  }

  static isDefined(object) {
    return ((typeof (object) === "undefined") || (object === null)) ? false : true;
  }

  static isUndefinedOf(array) {
    let result = false;
    for (let object of array) {
      result = result || ((typeof (object) === "undefined") || (object === null)) ? true : false;
      // TODO: Requires unit-testing
      //if (result) {
      //  console.log("🔨 [debug] isUndefinedOf", JSON.stringify(array, null, 2));
      //}
    }
    return result;
  }
  
};