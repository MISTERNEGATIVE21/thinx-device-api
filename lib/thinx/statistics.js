/*
 * This THiNX Device Management API module is responsible for aggregating daily statistics.
 */

const Globals = require("./globals.js");
const app_config = Globals.app_config();

const mkdirp = require("mkdirp");
const dateFormat = require("dateformat");
const fs = require("fs-extra");
const exec = require("child_process");
const readline = require("readline");

const InfluxConnector = require('../../lib/thinx/influx');
const Util = require("./util.js");

const Sanitka = require("./sanitka");

// Defines data model and also lists known tracked keys
const owner_template = {
	APIKEY_INVALID: [0],
	LOGIN_INVALID: [0],
	DEVICE_NEW: [0],
	DEVICE_CHECKIN: [0],
	DEVICE_REVOCATION: [0],
	BUILD_STARTED: [0],
	BUILD_SUCCESS: [0],
	BUILD_FAILED: [0]
};

function parse_line(owner, line) {
	if (typeof(owner) === "undefined") return;
	if (typeof(line) === "undefined") return;
	if (line.indexOf("APIKEY_INVALID") !== -1) {
		owner.APIKEY_INVALID[0]++;
	} else if (line.indexOf("LOGIN_INVALID") !== -1) {
		owner.LOGIN_INVALID[0]++;
	} else if (line.indexOf("DEVICE_NEW") !== -1) {
		owner.DEVICE_NEW[0]++;
	} else if (line.indexOf("DEVICE_CHECKIN") !== -1) {
		owner.DEVICE_CHECKIN[0]++;
	} else if (line.indexOf("DEVICE_REVOCATION") !== -1) {
		owner.DEVICE_REVOCATION[0]++;
	} else if (line.indexOf("BUILD_STARTED") !== -1) {
		owner.BUILD_STARTED[0]++;
	} else if (line.indexOf("BUILD_SUCCESS") !== -1) {
		owner.BUILD_SUCCESS[0] += 1;
	} else if (line.indexOf("BUILD_FAILED") !== -1) {
		owner.BUILD_FAILED[0]++;
	}
}


module.exports = class Statistics {

	constructor() {

		this.influx = new InfluxConnector('stats');

		const DATA_ROOT = app_config.data_root;

		this.LOG_PATH = DATA_ROOT + "/statistics/latest.log";
		this.TEMP_PATH = DATA_ROOT + "/statistics/stats.temp";
		this.STATS_PATH = DATA_ROOT + "/statistics/";

		this.once = false;
		this.path = "";
		this.exit_callback = null;
		this.parser = null;
		this._owner = "07cef9718edaad79b3974251bb5ef4aedca58703142e8c4c48c20f96cda4979c"; // test owner only

		// Create statistics folder if not found on init
		if (!fs.existsSync(this.STATS_PATH)) {
			console.log("Stats path", this.STATS_PATH, " not found, creating...");
			mkdirp(this.STATS_PATH);
		}

		try {
			fs.ensureFile(this.LOG_PATH); // make sure the file exists even when empty
		} catch (e) {
			console.log(e);
		}
	}

	static get_owner_template() {
		return owner_template;
	}

	/**
	* Returns today data created by ETL if available
	* @param {string} owner - restrict to owner
	* @param {function} callback (err, statistics) - async return callback, returns statistics or error
	*/

	async today_V2(owner, callback) {
		await this.influx.today(owner, (result) => {
            callback(result);
        });
	}

	/**
	* Returns weekly data created by ETL if available
	* @param {string} owner - restrict to owner
	* @param {function} callback (err, statistics) - async return callback, returns statistics or error
	*/

	async week_V2(owner, callback) {
		await this.influx.week(owner, (result) => {
            callback(result);
        });
	}

	get_all_owners() {

		this.owners = { "07cef9718edaad79b3974251bb5ef4aedca58703142e8c4c48c20f96cda4979c": Statistics.get_owner_template() }; // test owner only

		const Database = require("./database.js");
		let db_uri = new Database().uri();
		const userlib = require("nano")(db_uri).use(Globals.prefix() + "managed_users");

		userlib.view("users", "owners_by_id", {
			"include_docs": false
		}, (err, body) => {

			if (err || 
				(typeof (body) === "undefined") ||
				(typeof (body.rows) === "undefined") || 
				(body.rows.length === 0)
			) {
				return;
			}

			for (let index in body.rows) {
				let doc = body.rows[index];
				this.owners[doc.id] = Statistics.get_owner_template();
			}
		});
	}

	

	closeParsers() {
		for (var owner_id in this.owners) {
			var owner_data = this.owners[owner_id];
			var dirpath = this.STATS_PATH + owner_id;
			var path = dirpath + "/" + this.todayPathElement() + ".json";
			console.log(`ℹ️ [info] [closeParsers] writing stats to '${path}'`);
			var mkresult = fs.mkdirpSync(dirpath);
			if (mkresult) {
				console.log(`☣️ [error] [closeParsers] error creating statistic path for owner: ${mkresult}`);
			} else {
				try {
					this.write_stats(dirpath, path, owner_data);
				} catch (e) {
					console.log(`☣️ [error] [closeParsers] Error saving stats: ${e}`);
				}
			}
			if (typeof (this.exit_callback) === "function") {
				this.exit_callback(true, this.owners[owner_id]);
				this.exit_callback = false;
			}
		}
		if (fs.existsSync(this.TEMP_PATH)) {
			try {
				fs.unlink(this.TEMP_PATH);
			} catch (e) {
				console.log(`🔨 [debug] unlinking ${this.TEMP_PATH} failed`);
			}
		}
	}

	parse_oid_date_and_line(line) {
		if (line.indexOf("[OID:") === -1) return;
		var scanline = line.split("]");
		var oid = scanline[0].split("[OID:")[1];
		parse_line(this.owners[oid], line);
	}

	parse_oid(line) {

		if (line.indexOf("[debug]") !== -1) return;
		if (line.indexOf("[info]") !== -1) return;
		if (line.indexOf("[warning]") !== -1) return;

		var scanline = line.split("]");
		
		var oid = null;
		if (scanline.length > 2) {
			var otemp = scanline[2];
			if (otemp.indexOf("[OID:") !== -1) {
				oid = Sanitka.owner(otemp.substr(3).replace("[OID:", ""));
			}
		}
		// todo: validate owner-id using sanitka to make sure there was no nonsense parsed out...
		if (Util.isDefined(oid) && Util.isDefined(this.owners[oid])) {
			this.owners[oid] = Statistics.get_owner_template(); // init stat object per owner
			parse_line(this.owners[oid], line);
		}
	}

	ownerPath(owner) {
		return this.STATS_PATH + owner;
	}

	write(path_with_filename, owner_data) {
		let path_without_filename_arr = path_with_filename.split("/");
		delete path_without_filename_arr[path_without_filename_arr.length]; // delete last path element – the filename
		let path_without_filename = path_without_filename_arr.join("/").replace(".json", "");
		mkdirp(path_without_filename);
		fs.ensureFileSync(path_with_filename);
		try {
			fs.writeFileSync(
				path_with_filename,
				JSON.stringify(owner_data), {
				encoding: "utf-8",
				flag: "w",
				mode: 493
			} // 493 == 0755
			);
		} catch (statsWriteError) {
			console.log({ statsWriteError });
		}
	}

	// public
	merge_stats(old_data, owner_data) {
		let map = JSON.parse(old_data);
		let keys = Object.keys(map);
		for (let key in keys) {
			let value = keys[key];
			keys[key] = value + owner_data[key];
		}
		return owner_data;
	}

	write_stats(dirpath, filepath, owner_data) {
		try {
			mkdirp(dirpath); // folder with date only
		} catch (d) {
			console.log("mkdirp(dirpath) failed with", d);
		}
		if (fs.existsSync(filepath)) {
			let old_data = fs.readFileSync(filepath).toString();
			owner_data = this.merge_stats(old_data, owner_data);
		}
		this.write(filepath, owner_data); // replacing the file if already exists! it should merge counts actually...
	}

	/**
	* Performs ETL transaction from current log
	*/

	parse(owner, completed_callback) {

		this.get_all_owners();

		this.exit_callback = completed_callback;

		if (!fs.existsSync(this.LOG_PATH)) {
			console.log("[PARSE] THiNX log not found at:" + this.LOG_PATH);
			if (typeof (completed_callback) !== "undefined") completed_callback(false, "log_not_found in " + this.LOG_PATH);
			return;
		}

		fs.copy(this.LOG_PATH, this.TEMP_PATH, (err) => {

			if (err && (typeof (completed_callback) !== "undefined")) return completed_callback(false, err);
			
			this.parser = readline.createInterface({
				input: fs.createReadStream(this.TEMP_PATH),
				output: null,
				console: false,
				terminal: false
			});

			this.parser.on("line", (line) => {
				this.parse_oid_date_and_line(line);
			});
			this.parser.on("close", (/*line*/) => {
				this.closeParsers();
			});

			this.owners[owner] = Statistics.get_owner_template();
		});
	}

	extract_docker_logs(callback) {

		let container_id = exec.execSync("docker info -f $(hostname)");
		if (container_id.length < 4) {
			return callback();
		}

		fs.writeFileSync(this.LOG_PATH, "\n", { mode: 0x776 });

		let shell = exec.spawn("docker logs --timestamps $(hostname)", { shell: true }); // lgtm [js/command-line-injection]

		shell.stdout.on("data", (data) => {
			var logline = data.toString();
			fs.appendFile(this.LOG_PATH, logline, function (err) { // lgtm [js/command-line-injection]
				if (err) throw err;
			}); // lgtm [js/command-line-injection]
		});

		shell.stderr.on("data", (data) => {
			var error_string = data.toString();
			console.log(error_string);
		}); // end shell on error data

		shell.on("exit", (code) => {
			if (code > 0) {
				console.log("[warning] [stats] [dockerlog] result code non-null:", code);
			}
			callback();
		}); // end shell on exit
	}

	aggregate(callback) {

		// Fetch Service Logs in Swarm Mode, Fetch Container Logs in non-swarm mode

		this.extract_docker_logs(() => {

			this.get_all_owners();

			// Normal mode, expects file at log path (that may be pre-created by docker/swarm)

			if (!fs.existsSync(this.LOG_PATH)) {
				console.log("[AGGREGATE] THiNX log not found at:" + this.LOG_PATH);
				if (typeof (callback) === "function") callback(true, "log_not_found "); // no success
				return;
			}

			fs.copy(this.LOG_PATH, this.TEMP_PATH, (err) => {

				if (err) {
					if (typeof (callback) === "function") callback(false, "copy_error " + err); // no success
					return false;
				}

				this.parser = readline.createInterface({
					input: fs.createReadStream(this.TEMP_PATH),
					output: null,
					console: false,
					terminal: false
				});

				this.parser.on("line", (line) => {
					if (line.indexOf("[OID:") !== -1) {
						this.parse_oid(line);
					}
				});

				this.parser.on("close", (/*line*/) => {

					// This looks pretty like a bottleneck.
					for (var owner_id in this.owners) {
						if (typeof (owner_id) === "undefined") continue;
						if (owner_id === "undefined") continue;

						const owner_data = this.owners[owner_id];
						const dirpath = this.STATS_PATH + owner_id;
						var filepath = dirpath + "/" + this.todayPathElement() + ".json";
						this.path = filepath; // was consumed by deprecated parse_callback after all owners are parsed (last path)
						console.log("aggregate parser closed: Writing stats to dirpath '" + dirpath + "'");
						this.write_stats(dirpath, filepath, owner_data);
					}

					if (this._owner !== null) {
						this.path = this.STATS_PATH + this._owner + "/" + this.todayPathElement() + ".json";
					}

					// Expects global callback being set already
					if (typeof (callback) === "function") {
						callback(true, this.path); // should call callback
					}

					try {
						fs.unlink(this.TEMP_PATH);
					} catch (e) {
						// can throw if not exists
					}

				});
			});
		});
	}

	/**
	* Returns today data created by ETL if available
	* @param {string} owner - restrict to owner
	* @param {function} callback (err, statistics) - async return callback, returns statistics or error
	*/

	today(owner, callback) {

		if (typeof (callback) !== "undefined") {
			console.log("ℹ️ [info] [today] Setting new exit_callback in today()...");
			this.exit_callback = callback;
		}

		this._owner = owner; // sets global owner for a "today" parsers used in parse_oid_date_and_line() and aggregate()

		var xpath = this.ownerPath(owner) + "/" + this.todayPathElement() + ".json";
		console.log("[debug] today: Looking for file at xpath", xpath);
		this.path = xpath; // WTF? Side effect?

		if (!fs.existsSync(xpath)) {
			console.log(`ℹ️ [info] [today] Statistics not found on ${xpath}`);
			if (this.once === false) {
				this.once = true;
				this.aggregate(() => {
					this.today(owner, callback);
				});
			} else {
				console.log(`ℹ️ [info] [today] [nonce] Stats not found in ${xpath}`);
				if (typeof (callback) === "function") callback(false, "stats_not_found in " + xpath);
			}
		} else {
			var data = fs.readFileSync(xpath).toString();
			if (typeof (callback) === "function") callback(true, data);
		}
	}

	/**
	* Returns weekly data created by ETL if available
	* @param {string} owner - restrict to owner
	* @param {function} callback (err, statistics) - async return callback, returns statistics or error
	*/

	week(owner, callback) {

		var atLeastOneFileFound = false;
		var results = {};

		for (var d = 6; d >= 0; d--) {

			var wpath = this.ownerPath(owner) + "/" + this.weekPathElement(d) + ".json";
			console.log("[debug] stats week path for owner", wpath);
			if (!fs.existsSync(wpath)) continue;

			atLeastOneFileFound = true;

			var jsonData = fs.readFileSync(wpath).toString();
			console.log("[debug] jsonData", jsonData, "\nfrom", wpath );
			var data = JSON.parse(jsonData);
			if ((typeof (data) === "undefined") || (data === null)) continue;

			var skeys = Object.keys(data);
			for (var kindex in skeys) {
				var keyname = skeys[kindex];
				if (typeof (results[keyname]) === "undefined") {
					results[keyname] = [];
				}
				var keydata = data[keyname][0];
				if ((typeof(keydata) === "undefined") || (keydata === null)) {
					results[keyname].push(0);
				} else {
					results[keyname].push(keydata);
				}
			}
		}

		callback(atLeastOneFileFound, results);
	}

	todayPathElement() {
		return dateFormat(new Date(), "isoDate");
	}

	weekPathElement(daysBack) {
		const newDate = new Date(Date.now() - (86400000 * daysBack));
		return dateFormat(newDate, "isoDate");
	}

	forceLogPath(logpath) {
		this.LOG_PATH = logpath;
	}
};
