// Git Shell Manager

var Globals = require("./globals.js");
var app_config = Globals.app_config();
var fs = require("fs-extra");

const exec = require("child_process");

module.exports = class Git {

	checkResponse(rstring, local_path) {

		let valid_responses = [
			"already exists and is not an empty",
			"FETCH_HEAD",
			"up-to-date",
			"Checking out files: 100%",
			"done."
		];
		
		// default response is ''
		let success = false;
		for (let response in valid_responses) {
			if (rstring.indexOf(response) != -1) {
				success = true;
			}
		}

		if (typeof(local_path) !== "undefined") {
			success = fs.existsSync(local_path + "/basename.json"); // may throw! but does not work.
		}
		return success;
	}

	tryShellOp(cmd, local_path) {
		let success = false;
		let result;
		try {
			result = exec.execSync(cmd).toString(); // lgtm [js/command-line-injection]			
			if (result !== "") {
				console.log("git fetch cmd result:", result);
			}
		} catch (e) {
			console.log("[git] git rsa clone error: " + e);
		}		
		if (typeof(result) !== "undefined") {
			success = this.checkResponse(result, local_path);
		}
		return success;
	}

    fetch(owner, command, local_path) {
		let success = false;
		let RSAKey = require("./rsakey"); let rsa = new RSAKey();
		let key_paths = rsa.getKeyPathsForOwner(owner);
		if ((typeof(key_paths) === "undefined") || (key_paths.length < 1)) {
			console.log("ℹ️ [info] [git] no_rsa_keys_found");
			success = this.tryShellOp(command, local_path);
		} else {
			for (var kindex in key_paths) {
				var gfpfx = "ssh-agent sh -c 'ssh-add " + app_config.ssh_keys + "/" + key_paths[kindex] + "; ";
				let prefixed_command = gfpfx + command + "' 2>&1";
				console.log("[git fetch] trying command", prefixed_command);
				success = this.tryShellOp(prefixed_command, local_path);
				if (success) return success;
			}
		}
		return success;
	}

	prefetch(GIT_PREFETCH) {
		console.log(`🔨 [debug] git prefetch command:\n ${GIT_PREFETCH}`);
		var result = "";
		try {
			result = exec.execSync(GIT_PREFETCH).toString().replace("\n", "");
			if (result !== "Already up to date.") {
				console.log(`ℹ️ [info] [builder] git prefetch result: ${result}`);
			}
		} catch (e) { console.log("⚠️ [warning] git prefetch not successful..."); }
		return result;
	}
};