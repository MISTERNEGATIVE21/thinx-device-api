/** This THiNX Device Management API module is responsible for managing Sources. */

const Globals = require("./globals.js");
const app_config = Globals.app_config();
const prefix = Globals.prefix();

let fs = require("fs-extra");

let mkdirp = require("mkdirp");
let sha256 = require("sha256");
let exec = require("child_process");
let path = require("path");

let Sanitka = require("./sanitka"); let sanitka = new Sanitka();
let AuditLog = require("./audit"); let alog = new AuditLog();
let Platform = require("./platform");

let Git = require("./git"); let git = new Git();

const { v1: uuidV1 } = require('uuid');

module.exports = class Sources {

	constructor() {
		const Database = require("./database.js");
		let db_uri = new Database().uri();
		this.devicelib = require("nano")(db_uri).use(prefix + "managed_devices");
		this.userlib = require("nano")(db_uri).use(prefix + "managed_users");
	}

	detachDevice(device, removed_source_id) {
		console.log(`[debug] repo_revoke alias equal: Will upsert device: ${device.source} to ${removed_source_id}`);
		device.source = null;

		delete device._rev;
		this.devicelib.atomic("devices", "modify", device._id, device)
			.catch((mod_error) => {
				if (mod_error) console.log(`[debug] device modify error ${mod_error}`);
			});
	}

	removeSourcesFromOwner(owner, removed_sources) {
		this.devicelib.view("devices", "devices_by_owner", {
			key: owner,
			include_docs: true
		}, (err, body) => {

			if (err) return console.log(err);

			for (let rindex in body.rows) {
				let device;
				if (typeof (body.rows[rindex]) === "undefined") continue;
				if (body.rows[rindex].value !== null) device = body.rows[rindex].value;
				if ((typeof (device) === "undefined") || (device === null) || (device.source === null)) continue;
				for (let sindex in removed_sources) {
					let removed_source_id = removed_sources[sindex];
					if (device.source == removed_source_id) {
						this.detachDevice(device, removed_source_id);
					}
				}
			}
		});
	}

	upsertOwnerDocumentRepos(doc, callback) {
		let changes = { repos: doc.repos };
		// can be done using this.updateUser(owner, changes, callback); just needs better auditing
		this.userlib.get(doc._id, (error, /* body */) => {
			if (error) {
				alog.log(doc._id, "Profile update error " + error, "error");
				return callback(true, error);
			}
			this.userlib.atomic("users", "edit", doc._id, changes, (eerror, upsert_body) => {
				if (eerror === null) {
					alog.log(doc._id, "Profile updated successfully.");
					return callback(null, "source_added");
				}
				console.log("☣️ [error] [owner] upsert repo failed", { eerror }, { upsert_body });
				alog.log(doc._id, "upsertOwnerDocumentRepos.", "error");

				callback(error, "upsert_owner_document_repos");
			});
		});
	}

	addSourceToOwner(owner, source, temporary_source_path, source_callback) {
		this.userlib.get(owner, (err, doc) => {
			if (err) {
				console.log(err);
				return source_callback(false, err);
			}
			if (!doc) {
				console.log("Owner " + owner + " not found.");
				return source_callback(false, "user_not_found");
			}
			let sid = sha256(JSON.stringify(source) + new Date().toString());
			doc.repos[sid] = source;
			this.upsertOwnerDocumentRepos(doc, (upsert_err) => {
				if (upsert_err !== null) {
					console.log("/api/user/source upsertOwnerDocumentRepos ERROR:" + upsert_err);
					return source_callback(false, "source_not_added"); // why is this not same response as below? what about UI?
				}
				fs.removeSync(temporary_source_path);
				source_callback(true, {
					success: true,
					source_id: sid
				});
			});
		});
	}

	updateUserWithSources(doc, sources, really_removed_repos, callback) {
		doc.sources = sources;
		this.upsertOwnerDocumentRepos(doc, (upsert_err) => {
			if (upsert_err) {
				if (typeof (callback) !== "undefined") {
					callback(false, upsert_err);
				}
				return;
			}
			if (typeof (callback) !== "undefined") callback(true, {
				success: true,
				source_ids: really_removed_repos
			}); // callback
		});
	}

	cleanupDirectory(cleanup_path) {
		try {
			let CLEANUP = "cd " + cleanup_path + "; rm -rf *";
			console.log("Will cleanup directoy at", cleanup_path);
			exec.execSync(CLEANUP);
		} catch (e) {
			console.log(e);
		}
	}

	// Public

	/**
	* List all owner's sources
	*/

	list(owner, callback) {
		this.userlib.get(owner, (err, doc) => {
			if (err) {
				callback(false, err);
				return;
			}
			if (doc) {
				callback(true, doc.repos);
			} else {
				callback(false, "user_not_found");
			}
		});
	}

	/**
	* List limited to repository/branch
	*/

	ownerIdFromPath(local_path) {
		let owner_path = local_path.replace(app_config.build_root, "");
		owner_path = owner_path.replace(app_config.data_root, "");
		owner_path = owner_path.replace("/", ""); // drop only first leading slash
		let owner_path_array = owner_path.split("/");
		let owner_id = owner_path_array[0];
		if (owner_id.indexOf("repos") === 0) {
			owner_id = owner_path_array[1];
			console.log("overriding path array position, because /repos/ is first...");
		}
		return owner_id;
	}

	// required by githook
	withRepository(info, local_path, callback) {

		let repo_name = info.repository.name;
		let repo_branch = "main";

		if (typeof (info.ref) !== "undefined") {
			repo_branch = info.ref.replace("refs/heads/", "");
		}

		repo_branch = repo_branch.replace("origin", "");

		let owner_id = this.ownerIdFromPath(local_path);
		if (owner_id === null) {
			console.log("☣️ [error] Webhook's owner not found!");
			return callback([]);
		}
		this.userlib.get(owner_id, (err, doc) => {
			if ((err != null) || (typeof (doc) === "undefined")) {
				console.log("☣️ [error] doc is undefined in withRepository() for owner", owner_id, err);
				return callback([]);
			}
			let source_ids = [];
			let sources = doc.repos;
			let keys = Object.keys(sources);
			// parse all repos and return matching IDs
			for (let key of keys) {
				let source = sources[key];
				if (typeof (source.owner) !== "undefined") {
					if ((source.owner.indexOf(owner_id) != -1) &&
						(source.url.indexOf(repo_name) != -1) &&
						(source.branch.indexOf(repo_branch) != -1)) {
						source_ids.push(key);
					}
				}
			}
			callback(source_ids);
		});

	}

	/**
	* Add (do not break, works)
	*/

	get_inner_path(temp_path) {
		let directories = fs.readdirSync(temp_path).filter(
			file => fs.lstatSync(path.join(temp_path, file)).isDirectory()
		);
		let inner_path = temp_path + "/";
		if (typeof (directories[0]) !== "undefined" && directories[0] !== null)
			inner_path = temp_path + "/" + directories[0];
		return inner_path;
	}

	getTempPath(owner, source_id) {
		const OWNER_ROOT = app_config.data_root + app_config.build_root + "/" + owner;
		let TEMP_PATH = OWNER_ROOT + "/" + source_id;
		mkdirp.sync(TEMP_PATH);
		return TEMP_PATH;
	}

	// incoming can be origin/main, origin/master or whatever
	normalizedBranch(source, error_callback) {
		if (typeof (source.branch) === "undefined") source.branch = "main";
		let sanitized_branch = sanitka.branch(source.branch);
		if (sanitized_branch === null) {
			error_callback(true, "invalid_branch_name"); return false;
		}
		return sanitized_branch.replace("origin/", "");
	}

	validateURL(source, error_callback) {
		let sanitized_url = sanitka.url(source.url);
		if (sanitized_url !== null) {
			if (sanitized_url != source.url) {
				console.log("Invalid Git URL: '", sanitized_url, "', '", source.url, "'");
				error_callback(false, "Invalid Git URL");
				return false;
			}
		}
		return sanitized_url;
	}

	// Performs pre-fetch to temporary directory, required for inferring target platform and verification.
	add(source, callback) {

		source.source_id = uuidV1();

		let TEMP_PATH = this.getTempPath(source.owner, source.source_id);

		let sanitized_branch = this.normalizedBranch(source, callback);
		if ((sanitized_branch === false) || (sanitized_branch === null)) {
			console.log("source add rejected: source_branch_insane", sanitized_branch); // remove
			return callback(false, "source_branch_insane");
		}

		let sanitized_url = this.validateURL(source, callback);
		if ((sanitized_url === false) || (sanitized_url === null)) {
			console.log("source add rejected: source_url_insane", sanitized_url); // remove
			return callback(false, "source_url_insane");
		}

		console.log(`ℹ️ [info] Prefetch with sanitized url ${sanitized_url} and branch ${sanitized_branch}`);

		// Clones the repo onto specified path and marks success using the basename.json file
		let PREFETCH_CMD = "set +e; mkdir -p " + TEMP_PATH +
			"; cd " + TEMP_PATH +
			"; rm -rf *; " + "if $(git clone -b " + sanitized_branch + " \"" + sanitized_url + "\");" +
			"then cd * && chmod -R 666 * && " +
			"echo { \"basename\":\"$(basename $(pwd))\", \"branch\":\"" + sanitized_branch + "\" } > ../basename.json; fi";

		let is_private = false;

		// Try to fetch
		const git_success = git.fetch(source.owner, PREFETCH_CMD, TEMP_PATH);

		// If this fails, retry using RSA keys...
		if (git_success === false) {
			this.cleanupDirectory(TEMP_PATH);
			if (!git.fetch(source.owner, PREFETCH_CMD, TEMP_PATH)) {
				return callback(false, "Git fetch failed.");
			} else {
				is_private = true;
			}
		}

		let inner_path = this.get_inner_path(TEMP_PATH);

		Platform.getPlatform(inner_path, (success, platform) => {
			switch (success) {
				case true: {
					source.is_private = is_private;
					source.platform = platform;
					source.initial_platform = platform; // should happen only on add
					this.addSourceToOwner(source.owner, source, TEMP_PATH, callback); // returns success, response
					// this.cleanupDirectory(TEMP_PATH);
				} break;
				case false: {
					console.log("[sources add] getPlatform failed! Platform: " + platform);
				} break;
			}
		});
	}

	/**
	* Revoke Source for owner
	* @param {string} owner - owner._id
	* @param {string} sources - array of source_ids to be revoked
	* @param {function} callback(success, message) - operation result callback
	*/

	remove(owner, removed_sources, callback) {

		this.userlib.get(owner, (err, doc) => {
			if (err || !doc) {
				console.log("Owner " + owner + " not found.");
				return callback(false, "user_not_found");
			}

			let sources = doc.repos;
			let source_ids = Object.keys(sources);
			let really_removed_repos = [];
			for (let source_id in removed_sources) {
				let removed_source_id = removed_sources[source_id];
				let sources_source_id = sources[removed_source_id];
				if ((typeof (sources_source_id) !== "undefined") && (sources_source_id !== null)) {
					really_removed_repos.push(source_ids[source_id]);
					delete sources[removed_source_id];
				}
			}
			this.updateUserWithSources(doc, sources, really_removed_repos, callback);
			this.removeSourcesFromOwner(owner, removed_sources);
		});
	}

	updateUser(owner, changes, complete_callback) {
		this.userlib.atomic("users", "edit", owner, changes, (uerror/* , abody */) => {
			if (uerror) {
				console.log(`☣️ [error] ${uerror} in atomic changes ${JSON.stringify(changes)}`);
				alog.log(owner, "Atomic update failed.", "error");
				return complete_callback(false, "atomic_update_failed");
			}
			alog.log(owner, "Atomic tag updated successfully.", changes);
			complete_callback(true);
		});
	}

	updatePlatform(owner, source_id, platform, complete_callback) {
		if (typeof (platform) !== "string") {
			console.log("Invalid platform type submitted on update. Should have been a string.");
			return complete_callback(false);
		}
		this.userlib.get(owner, (err, doc) => {
			if (err || !doc) {
				console.log(`[error] Owner ${owner} not found.`);
				return complete_callback(false, "user_not_found");
			}
			let changes = doc.repos;
			if (typeof (changes[source_id]) === "undefined") {
				console.log(`[error] Source ID ${source_id} not found in owner ${owner}`);
				return complete_callback(false, "source_not_found");
			}
			changes[source_id].platform = platform; // lgtm [js/prototype-polluting-assignment]
			if (typeof (complete_callback) === "undefined") throw new Error("updatePlatform missing callback");
			this.updateUser(owner, { repos: changes }, complete_callback);
		});
	}

	update(owner, source_id, tag, value, complete_callback) {
		this.userlib.get(owner, (err, doc) => {
			if (err || !doc) {
				console.log(`[error] Owner ${owner} not found.`);
				return complete_callback(false);
			}

			let changes = doc.repos;
			if (typeof (changes[source_id]) === "undefined") {
				console.log(`[error] Source ID ${source_id} not found in owner ${owner}`);
				return complete_callback(false, "source_not_found");
			}

			// pollution should not matter here, this is called only internally and value is enumerated
			changes[source_id][tag] = value; // lgtm [js/prototype-polluting-assignment]

			this.updateUser(owner, { repos: changes }, complete_callback);
		});
	}
};
