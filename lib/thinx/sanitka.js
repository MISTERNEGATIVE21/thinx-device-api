/** This THiNX Device Management API module is responsible for input value sanitation. */

module.exports = class Sanitka {

	static branch(input) {
		if (typeof (input) === "undefined") return "main";
		var sanitized_branch = input.replace(/[\\{}!'&]/g, "");
		if (input !== sanitized_branch) {
			console.log(`⚠️ [warning] sanitizing branch failed because '${input}' does not match output '${sanitized_branch}'`);
			return null;
		}
		sanitized_branch = sanitized_branch.replace("origin/", "");
		return sanitized_branch;
	}

	branch(input) {
		return Sanitka.branch(input);
	}

	static url(input) {
		if ((typeof (input) === "undefined") || (input == null)) return null;
		var output = input;
		output = output.replace(/['{}\\";&]/g, "");
		if (input === output) return output;
		console.log("⚠️ [warning] URL not sanitized, contains invalid characters.");
		return null;
	}

	url(input) {
		return Sanitka.url(input);
	}

	static udid(input) {
		if (typeof (input) !== "string") return null;
		if (input.length !== 36) return null;
		var sanitized_branch = input.replace(/[\.{\/}\\"';&@]/g, "");
		let valid_udid = /^([a-fA-F0-9-]{36,})$/.test(input);
		if (valid_udid && (input === sanitized_branch)) {
			return sanitized_branch;
		} else {
			console.log("⚠️ [warning] UDID RegEx and replace failed:", input, sanitized_branch);
		}
		return null;
	}

	udid(input) {
		return Sanitka.udid(input);
	}

	static username(input) {
		if ((typeof (input) === "undefined") || (input == null)) return null;
		var sanitized_username = input.replace(/[{}\\"';&@]/g, "");
		if (input === sanitized_username) return sanitized_username;
		return null;
	}

	username(input) {
		return Sanitka.username(input);
	}

	static document_id(input) {
		if ((typeof (input) === "undefined") || (input == null)) return null;
		var sanitized_owner = input.replace(/[{}\\"';&@]/g, "");
		let valid = /^([a-z0-9]{64,})$/.test(input);
		if (valid) {
			return sanitized_owner;
		} else {
			console.log("⚠️ [warning] document identifier invalid", { input });
		}
		return null;
	}

	// should allow only a-z0-9 in length of exactly 64 characters
	source(input) {
		return Sanitka.document_id(input); // no need to initialize this class, convert to static!
	}

	owner(input) {
		return Sanitka.document_id(input); // no need to initialize this class, convert to static!
	}	

	// remove posible shell escapes to make git work
	static deescape(url) {
		if ((typeof (url) === "undefined") || (url == null)) return null;
		let sanitized_url = url.replace(/['";]/g, "");
		if (url === sanitized_url) return sanitized_url;
		return null;
	}

	deescape(url) {
		return Sanitka.deescape(url);
	}

	// should support both Android and iOS push tokens
	static pushToken(token) {
		if (typeof (token) !== "string") return null;
		let sanitized_token = token.replace(/["'\s]/g, "");

		if (token.length == 64) {
			// 31b1f6bf498d7cec463ff2588aca59a52df6f880e60e8d4d6bcda0d8e6e87823
			let valid_ios = /^([a-fA-F0-9]{64,})$/.test(token);
			if (valid_ios) return sanitized_token;
		} else {
			let valid_android = /^([a-zA-Z0-9_:-]+)$/.test(token);
			// akO1-XdQYgk:APA91bHmgm_K500RVhexcxFVoczhp5RuMSKC07kOJB7T31xq2_a9tkUAFVGQNwtZ2JORj79lDRI0ow-nP17y82GD1zTWJTEnyjNMas_qNUKxBot1P-vM6v-BW7sqcISak8sXMK91WfmH
			if (valid_android) return sanitized_token;
		}
		
		return null;
	}

	pushToken(token) {
		return Sanitka.pushToken(token);
	}

	// should support own api keys
	static apiKey(token) {
		if ((typeof (token) === "undefined") || (token == null)) return null;
		let sanitized_token = token.replace(/["\s]/g, "");
		let valid = /^([a-z0-9]{64,})$/.test(sanitized_token);
		if (valid) {
			if (token === sanitized_token) return sanitized_token;
		}
		return null;
	}

	apiKey(token) {
		return Sanitka.apiKey(token);
	}

};
