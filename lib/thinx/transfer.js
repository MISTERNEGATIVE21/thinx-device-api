/** This THiNX Device Management API module is responsible for device transfer management. */

var Globals = require("./globals.js");
var app_config = Globals.app_config();
var prefix = Globals.prefix();

const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
	username: 'api',
	key: app_config.mailgun.api_key
  });

var fs = require("fs-extra");

const Database = require("./database.js");
let db_uri = new Database().uri();
var userlib = require("nano")(db_uri).use(prefix + "managed_users");
var sha256 = require("sha256");
var redis = require("redis");

var AuditLog = require("./audit"); var alog = new AuditLog();
var Device = require("./device"); var device = new Device();
var Devices = require("./devices");
var Deployment = require("./deployment"); var deploy = new Deployment();

const { v4: uuidV4 } = require('uuid');

module.exports = class Transfer {

	constructor(messenger) {
		this.client = redis.createClient(Globals.redis_options());
		this.messenger = messenger;
		this.devices = new Devices(messenger);
		console.log("✅ [info] Loaded module: Transfer");
	}

	// migration

	transfer_valid(encoded_json_keys, dtid, callback) {

		var json_keys = JSON.parse(encoded_json_keys);

		if (json_keys === null) {
			console.log("[transfer] No udids remaining, expiring record...");
			this.client.expire(dtid, 1); // WTF? This won't be available in strict mode but we can make one...
			callback(true, "transfer_completed");
			return false;
		}

		return true; // no callback called, continue with transfer...
	}

  migrate_device(original_owner, xudid, recipient, body, json_keys, callback) {

		let changes = {
			udid: xudid,
			owner: recipient,
			previous_owner: original_owner
		};

		device.edit(original_owner, changes, (success, xchanges) => {
			if (!success) console.log("🔨 [debug] [transfer] DEC", {success}, {xchanges});
		});

		delete json_keys.udids[xudid];

		// Move all data:
		const original_path = deploy.pathForDevice(original_owner, xudid);
		const destination_path = deploy.pathForDevice(recipient, xudid);
		if (fs.existsSync(original_path)) {
			this.rename(original_path, destination_path);
		} else {
			console.log("⚠️ [warning] [transfer] original device path does not exist.");
		}

		console.log("ℹ️ [info] [transfer] Device builds artefacts transfer ended.");

		// Move all repositories/move sources

		if (body.mig_sources === true) {
			var old_sources_path = original_path.replace(app_config.deploy_root, app_config.data_root + app_config.build_root);
			var new_sources_path = destination_path.replace(app_config.deploy_root, app_config.data_root + app_config.build_root);
			console.log("Should rename " + old_sources_path + " to " + new_sources_path);
			if (fs.existsSync(old_sources_path)) {
				this.rename(old_sources_path, new_sources_path);
			} else {
				console.log("Warning, old sources path does not exist.");
			}

			const usid = device.source;
			this.move_source(usid, original_owner, recipient, (success) => {
				if (success) {
					this.attach_source(recipient, usid, xudid);
				}
			});
		}

		// Move all repositories:
		if (body.api_keys === true) {
			// #THX-396: Migrate API Keys from original owner to recipient in Redis!"
			// get device, fetch its API Key hash, find this in Redis and migrate to another user
			this.migrate_api_keys(original_owner, recipient, xudid, callback);
		} else {
			callback();
		}
	}

	migrate_api_keys(original_owner, recipient, xudid, callback) {

		var source_id = "ak:" + original_owner;
		var recipient_id = "ak:" + recipient;

		this.devices.get(xudid, (success, dev) => {
			if (!success) {
				console.log("[critical] device get for migration failed!");
				return;
			}
			const last_key_hash = dev.lastkey;

			// Get source keys
			this.client.get(source_id, (err1, json_keys) => {
				if (err1) {
					console.log("[critical] client 1 get for migration failed!");
					return;
				}
				var json_array = JSON.parse(json_keys);
				var delete_this = null;
				var migrate_this = null;
				for (var ai in json_array) {
					var item = json_array[ai];
					if (sha256(item) == last_key_hash) {
						delete_this = ai;
						migrate_this = item;
					}
				}

				// Get recipient keys
				this.client.get(recipient_id, (err2, recipient_keys) => {
					if (err2) {
						console.log("[critical] client 2 get for migration failed!");
						return;
					}
					var recipient_array = JSON.parse(recipient_keys);
					if (delete_this) {
						recipient_array.push(migrate_this);
						delete json_array[delete_this];
					}
					// Save array with respective API Key removed
					this.client.set(source_id, JSON.stringify(json_array), (err3 /*, removal_response */) => {
						if (err3) callback(false, err3);
						// Save new array with respective API Key added
						this.client.set(recipient_id, JSON.stringify(recipient_array), (err4 /*, transfer_response */) => {
							if (err4) {
								callback(false, err4);
								return;
							}
							callback(true, "api_keys_migrated"); // ??
						});
					});
				});

			}); // this.client.get

		}); // devices.get

	} // end migrate_api_keys

	rename(from, to) {
		fs.rename(from, to, (err) => {
			if (err) {
				console.log("☣️ [error] [transfer] caught rename error:", err);
			}
		});
	}

	move_source(usid, original_owner, target_owner, callback) {

		userlib.get(original_owner, (err1, abody) => {

			if (err1) {
				callback(false, err1);
				return;
			}

			userlib.get(target_owner, (err2, bbody) => {

				if (err2) {
					callback(false, err2);
					return;
				}

				var osources = abody.sources;
				var tsources = bbody.sources;
				tsources[usid] = osources[usid];

				delete osources[usid];

				userlib.atomic("users", "edit", abody._id, {
					sources: tsources
				}, (error/* , response */) => {
					if (error) {
						console.log("☣️ [error] Source transfer failed: " + error);
					} else {
						alog.log(abody._id, "Source transfer succeeded.");
					}
				});

			});
		});
	}

	attach_source(target_owner, usid, udid) {
		this.devices.attach(target_owner, {
			source_id: usid,
			udid: udid
		}, (success, response) => {
			if (!success) {
				console.log("☣️ [error] Migration error:" + response);
			}
			if (response) {
				console.log("ℹ️ [info] Migration response:" + response);
			}
		});
	}

	exit_on_transfer(udid, result_callback) {
		this.client.get("dtr:" + udid, (err, reply) => {
			if (!err && (reply === null)) {
				console.log("ℹ️ [info] exit_on_transfer reply", {reply});
				console.log("ℹ️ [info] Device already being transferred:", udid);
				result_callback(false);
			}
		});
	}

	store_pending_transfer(udid, transfer_id) {
		this.client.set("dtr:" + udid, transfer_id);
		this.client.expire("dtr:" + udid, 86400); // expire pending transfer in one day...
	}

	// public

	sendMail(contents, type, callback) {
		mg.messages.create(app_config.mailgun.domain, contents)
			.then((/* msg */) => {
				callback(true, {
					success: true,
					status: type + "_sent"
				});
			}) 
			.catch(err => {
				console.log(`☣️ [error] mailgun err ${err}`);
				callback(false, type + "_failed", err);
			});
	}

	request(owner, body, callback) {

		// body should look like { "to":"some@email.com", "udids" : [ "some-udid", "another-udid" ] }

		// THX-396

		// when true, sources will be COPIED to new owner as well
		if (typeof(body.mig_sources) === "undefined") {
			body.mig_sources = false;
		}

		// when true, API Keys will be TRANSFERRED:
		// - MQTT combination udid/apikey does not change
		// - API Keys are deleted from sender and added to recipient
		if (typeof(body.mig_apikeys) === "undefined") {
			body.mig_apikeys = false;
		}

		// Generic Check
		if (typeof(body.to) === "undefined") {
			callback(false, "missing_recipient");
			return;
		}

		if (typeof(body.udids) === "undefined") {
			callback(false, "missing_subject");
			return;
		}

		var recipient_id = sha256(prefix + body.to);

		var result = true;

		function result_callback(status) {
			result = status;
		}

		// check whether this device is not transferred already
		for (var udid in body.udids) {
			if (udid != 0) {
				this.exit_on_transfer(udid, result_callback);
			}
		}

		// When the loop above completes (we should give it a time...)
		// `result` should stay true otherwise there's already
		// transfer in progress.

		if (result === false) {
			callback(false, "transfer_already_in_progress");
			return;
		}

		userlib.get(owner, (err, ownerdoc) => {

			if (err) {
				console.log("Owner", owner, "unknown in transfer request!");
				callback(false, "owner_unknown");
				return;
			}

			userlib.get(recipient_id, (zerr/* , recipient */) => {

				if (zerr) {
					callback(false, "recipient_unknown");
					console.log("☣️ [error] Transfer target " + body.to + " id " + recipient_id + "not found?");
					return;
				}

				// 2. add recipient to body as "from"
				body.from = ownerdoc.email;

				// 2. add recipient to body as "from"

				// 3. store as "dt:uuid()" to redis
				var transfer_uuid = uuidV4(); // used for email
				var transfer_id = "dt:" + transfer_uuid;

				this.client.set(transfer_id, JSON.stringify(body), (werr/* , ignored_result */) => {

					if (werr) {
						console.log("☣️ [error] Transfer redis save error: " + werr);
						callback(false, "transfer_ticket_save_error");
						return;
					}

					// 4. respond with success/failure to the request
					callback(true, transfer_uuid);

					let udids = body.udids;

					if ( typeof(udids) === "undefined" ) {
						console.log("Transfer expects udids in body", body);
						return;
					}

					for (var did in udids) {
						this.store_pending_transfer(did, transfer_id);
					}

					var htmlDeviceList = "<p><ul>";
					for (var dindex in body.udids) {
						htmlDeviceList += "<li>" + udids[dindex] + "</li>";
					}
					htmlDeviceList += "</ul></p>";

					var plural = "";
					if (body.udids.length > 1) plural = "s";

					var port = "";
					if (typeof(app_config.debug.allow_http_login) !== "undefined" && app_config.debug.allow_http_login === true) {
						port = app_config.port;
					}

					var recipientTransferEmail = {
						from: 'THiNX API <api@' + app_config.mailgun.domain + '>',
						to: body.to,
						subject: "Device transfer requested",
						text: "<!DOCTYPE html><p>Hello " + body.to + ".</p>" +
							"<p> User with e-mail " + body.from +
							" is transferring following device" + plural + " to you:</p>" +
							htmlDeviceList +
							"<p>You may " +
							"<a href='" + app_config.api_url + port + "/api/transfer/accept?transfer_id=" +
							transfer_uuid + "'>Accept</a> or" +
							"<a href='" + app_config.api_url + port + "/api/transfer/decline?transfer_id=" +
							transfer_uuid + "'>Decline</a> this offer.</p>" +
							"</html>"
					};

					console.log(`ℹ️ [info] Sending transfer e-mail to ${recipientTransferEmail.from}`);

					this.sendMail(recipientTransferEmail, "recipient_transfer", () => {});

					var senderTransferEmail = {
						from: 'THiNX API <api@' + app_config.mailgun.domain + '>',
						to: body.from,
						subject: "Device transfer requested",
						text: "<!DOCTYPE html><p>Hello " + body.from + ".</p>" +
							"<p> You have requested to transfer following devices to " +
							body.to +
							":</p>" +
							htmlDeviceList +
							"<p>You will be notified when your offer will be accepted or declined.</p>" +
							"</html>"
					};

					console.log("ℹ️ [info] Sending transfer e-mail to sender: " + JSON.stringify(senderTransferEmail));

					if (process.env.ENVIRONMENT === "test") {
						if (body.to == "cimrman@thinx.cloud") {
							callback(true, transfer_id.replace("dt:", ""));
						}
						return;
					}

					this.sendMail(recipientTransferEmail, "recipient_transfer", (success, error) => {
						if (process.env.ENVIRONMENT === "test") {
							callback(success, "test"); // ignored in test
						} else {
							callback(success, error);
						}
					});
				});
			});
		});
	}

	accept(body, accept_callback) {

		// minimum body should look like { "transfer_id":"uuid" }
		// optional body should look like { "transfer_id":"uuid", "udids" : [ ... ] }

		if (typeof(body.transfer_id) === "undefined") {
			accept_callback(false, "missing_transfer_id");
			return;
		}

		var transfer_id = body.transfer_id;
		var udids = [];

		// Possibly partial transfer but we don't know until count
		if (typeof(body.udids) !== "undefined") {
			udids = body.udids;
		}

		const dtid = "dt:" + transfer_id;
	
		this.client.get(dtid, (err, encoded_json_keys) => {

			let keys = JSON.stringify(encoded_json_keys);

			console.log(`🔨 [debug] [transfer] Fetched DTID: ${dtid} with error ${err} and keys ${{keys}}`);

			if (err) {
				console.log("⚠️ [warning] [transfer] transfer_id not found.", err);
				accept_callback(false, "transfer_id_not_found");
				return;
			}

			if (encoded_json_keys === null) {
				accept_callback(false, "transfer_id_not_found");
				return;
			}

			var json_keys = JSON.parse(encoded_json_keys);

			if (!this.transfer_valid(encoded_json_keys, dtid, accept_callback)) return;

			if (typeof(json_keys.udids) === "undefined") {
				json_keys.udids = [];
			}

			// perform on all devices if udids not given
			console.log(`🔨 [debug] [transfer] L1 udids: ${udids}`);
			if ((typeof(udids) !== "undefined") && (udids.length === 0)) udids = json_keys.udids;

			var expiry = 3600; // 1 hour to let user accept/decline different devices
			var recipient_email = json_keys.to;

			if (typeof(recipient_email) === "undefined" || recipient_email === null) {
				accept_callback(false, "recipient_to_must_be_set");
				return;
			}

			var recipient = sha256(prefix + recipient_email);
			var original_owner_email = json_keys.from;

			if ( (typeof(original_owner_email) === "undefined") || (original_owner_email === null) ) {
				accept_callback(false, "originator_from_must_be_set");
				return;
			}

			var original_owner = sha256(prefix + original_owner_email);

			// Check if there are some devices left
			console.log(`🔨 [debug] [transfer] L2 LEFT keys: ${json_keys.udids}`);
			if ((typeof(json_keys.udids) !== "undefined") && json_keys.udids.length === 0) {
				this.client.expire(dtid, 1);
				for (var udid in udids) {
					this.client.expire("dtr:" + udid, 1);
				}
				accept_callback(true, "transfer_completed");
				return;
			}

			let sentence = `Accepting device transfer ${transfer_id} for devices ${JSON.stringify(udids)}`;
			alog.log(original_owner, sentence);
			alog.log(recipient, sentence);

			console.log("[OID:" + recipient + "] [TRANSFER_ACCEPT] ", { udids });

			const locked_udids = udids;

			function save_dtid(dtid, json_keys, accept_callback) {
				this.client.set(dtid, JSON.stringify(json_keys), (xerr, response) => {
					if (xerr) {
						console.log(`☣️ [error] [transfer] accept set error ${xerr} with response ${response}`);
						accept_callback(false, xerr);
					} else {
						console.log(`🔨 [debug] [transfer] Accepted udids ${json_keys.udids}`);
						if (json_keys.udids.length > 1) {
							accept_callback(true, "transfer_partially_completed");
							this.client.expire(dtid, expiry);
						} else {
							accept_callback(true, "transfer_completed");
							this.client.expire(dtid, 1);
						}
					}
				});
			}

			for (var dindex in locked_udids) {
				const list = locked_udids[dindex];

				this.migrate_device(original_owner, list, recipient, body, json_keys, () => {
					console.log("🔨 [debug] [transfer] [accept] ", {dindex}, {locked_udids});
					if (dindex == locked_udids.length - 1) {
						save_dtid(dtid, json_keys, accept_callback);
					} else {
						console.log("🔨 [debug] [transfer] transferring locked udid index:", dindex);
					}
				});
			}
		});
	}

	storeRemainingKeys(dtid, json_keys, callback) {
		this.client.set(dtid, JSON.stringify(json_keys), (err/* , response */) => {
			if (err) {
				callback(false, err);
				return;
			}
			console.log(`🔨 [debug] [transgfer] L4 Storing remaining keys: ${json_keys.udids}`);
			if (json_keys.udids.length > 1) {
				callback(true, "transfer_partially_completed");
				this.client.expire(dtid, 3600); // 1 hour to let user accept/decline different devices
			} else {
				callback(true, "transfer_completed");
				this.client.expire(dtid, 1);
			}
		});
	}

	decline(body, callback) {

		// minimum body should look like { "transfer_id":"uuid" }
		// optional body should look like { "transfer_id":"uuid", "udids" : [ ... ] }

		if (typeof(body.transfer_id) === "undefined") {
			callback(false, "missing_transfer_id");
			return;
		}

		console.log(`[transfer][decline] body: ${JSON.stringify(body)}`);

		var transfer_id = body.transfer_id;
		var udids = [];

		// Possibly partial transfer but we don't know until count
		if ((typeof(body.udids) !== "undefined") && (body.udids !== null)) {
			udids = body.udids;
		}

		var dtid = "dt:" + transfer_id;

		console.log(`🔨 [debug] [transfer] getting DTID ${dtid} on decline`);

		this.client.get(dtid, (err, json) => {

			let json_keys = JSON.parse(json);

			console.log("dtid get", {err}, {json_keys});

			if (err !== null) {
				console.log("[transfer] error", err);
				callback(false, "transfer_id_invalid");
				return;
			}

			if (json_keys === null) {
				console.log("[transfer] no such transfer anymore");
				callback(true, "decline_complete_no_such_dtid");
				return;
			}

			console.log(`🔨 [debug] [transfer] L5 udids ${udids}`);

			if ((udids.length === 0) && (typeof(json_keys) !== "undefined")) {
				// perform on all devices if udids not given
				udids = json_keys.udids;
			}

			// Check if there are some devices left
			console.log(`🔨 [debug] [transfer] L6 udids ${json_keys.udids}`);

			if (json_keys.udids.length == 0) {
				this.client.del(dtid);
			}

			var recipient_email = json_keys.to;
			var recipient = sha256(prefix + recipient_email);
			var original_owner_email = json_keys.from;
			var original_owner = sha256(prefix + original_owner_email);


			console.log(`🔨 [debug] [transfer] Declining transfer ${transfer_id}`);

			alog.log(original_owner, "Declining device transfer: " + transfer_id + " for devices: " + JSON.stringify(udids), "warning");
			alog.log(recipient, "Declining device transfer: " + transfer_id + " for devices: " + JSON.stringify(udids), "warning");
			console.log("[OID:" + recipient + "] [TRANSFER_DECLINE] " + JSON.stringify(udids));

			for (var dindex in udids) {
				var udid = udids[dindex];
				delete json_keys.udids[udid];
			}

			// Store remaining (not declined) keys
			this.storeRemainingKeys(dtid, json_keys, callback);

			callback(true, "decline_completed");
		});
	}

};
