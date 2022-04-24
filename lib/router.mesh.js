// /api/v2/mesh

var User = require("../lib/thinx/owner"); var user = new User();
const Util = require("./thinx/util");
const Sanitka = require("./thinx/sanitka"); var sanitka = new Sanitka();

function deleteMesh(req, res) {

    if (!Util.validateSession(req)) return res.status(401).end();

    if (!Util.isDefined(req.body)) return Util.respond(res, { success: false, status: "Body missing." });

    if (typeof (req.body) !== "object") return Util.respond(res, { success: false, status: "Invalid request format." });

    console.log(`[debug] /api/mesh/delete body: ${JSON.stringify(req.body)}`);

    let owner_id = sanitka.owner(req.body.owner_id);
    if (owner_id == null) {
        if (Util.isDefined(req.session.owner)) {
            owner_id = req.session.owner;
        } else {
            return Util.responder(res, false, "owner_invalid");
        }
    }

    let mesh_ids = req.body.mesh_ids;
    if (!Util.isDefined(mesh_ids)) return Util.responder(res, false, "mesh_ids_missing");

    user.deleteMeshes(owner_id, mesh_ids, function (success, status) {
        Util.responder(res, success, status);
    });
}

function getListMeshes(req, res) {

    if (!Util.validateSession(req)) return res.status(401).end();

    let owner_id = sanitka.owner(req.body.owner_id);
    if (owner_id == null) {
        if (Util.isDefined(req.session.owner)) {
            owner_id = req.session.owner;
        } else {
            return Util.responder(res, false, "owner_invalid");
        }
    }

    user.listMeshes(owner_id, (success, mesh_ids) => {
        Util.respond(res, {
            success: success,
            reponse: mesh_ids
        });
    });
}

function postListMeshes(req, res) {

    if (!Util.validateSession(req)) return res.status(401).end();

    let owner_id = sanitka.owner(req.body.owner_id);
    if (owner_id == null) {
        if (Util.isDefined(req.session.owner)) {
            owner_id = req.session.owner;
        } else {
            return Util.responder(res, false, "owner_invalid");
        }
    }

    user.listMeshes(owner_id, (success, mesh_ids) => {
        Util.respond(res, {
            success: success,
            reponse: mesh_ids
        });
    });
}

function createMesh(req, res) {

    if (!Util.validateSession(req)) return res.status(401).end();
    if (!Util.isDefined(req.body)) return Util.respond(res, { success: false, reponse: "body_missing" });

    let owner_id = sanitka.owner(req.body.owner_id);
    if (owner_id == null) {
        if (!Util.isDefined(req.session.owner)) return Util.responder(res, false, "owner_invalid");
        owner_id = req.session.owner;
    }

    if (!Util.isDefined(req.body.mesh_id)) return Util.respond(res, { success: false, reponse: "mesh_id_missing" });
    let mesh_id = req.body.mesh_id;

    let mesh_alias = mesh_id;
    if (Util.isDefined(req.body.alias)) mesh_alias = req.body.alias;

    user.createMesh(owner_id, mesh_id, mesh_alias, (success, response) => {
        if (!success) return Util.respond(res, { success: success, reponse: "mesh_create_failed" });
        Util.respond(res, { success: success, mesh_ids: response });
    });
}

module.exports = function (app) {

    ///////////////////////////////////////////////////////////////////////
    // API ROUTES v2
    //

    // Uses session owner as authentication
    app.get("/api/v2/mesh", function (req, res) {
        getListMeshes(req, res);
    });

    app.put("/api/v2/mesh", function (req, res) {
        createMesh(req, res);
    });

    app.delete("/api/v2/mesh", function (req, res) {
        deleteMesh(req, res);
    });

    ///////////////////////////////////////////////////////////////////////
    // API ROUTES v1
    //

    // Uses session owner as authentication
    app.get("/api/mesh/list", function (req, res) {
        getListMeshes(req, res);
    });

    // Uses session owner in body, should require API Key authentication
    app.post("/api/mesh/list", function (req, res) {
        postListMeshes(req, res);
    });

    app.post("/api/mesh/create", function (req, res) {
        createMesh(req, res);
    });

    app.post("/api/mesh/delete", function (req, res) {
        deleteMesh(req, res);
    });

};