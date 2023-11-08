/*
 * This THiNX Device Management API module is responsible for managing repositories.
 */

var Globals = require("./globals.js");
var app_config = Globals.app_config();
var finder = require("fs-finder");

var Devices = require("./devices"); 
var Sources = require("./sources"); var sources = new Sources();
var Platform = require("./platform");

let fs = require("fs-extra");
var crypto = require('crypto');
module.exports = class Repository {

	constructor(messenger, redis, queue) {
		if ((typeof(redis) === "undefined") || (redis === null)) {
            console.log(app);
            throw new Error("Redis client missing in Repository.js:17");
        }
		this.queue = queue;
		this.platform = new Platform();
		this.devices = new Devices(messenger, redis); // we need Devices but without messenger, only the DB access for udids with source...
	}

	static findAllRepositories() {
		var repositories_path = app_config.data_root + app_config.build_root;
		var repo_gits = finder.from(repositories_path).showSystemFiles().findDirectories(".git");
		console.log(`ℹ️ [info] [findAllRepositories] Search completed with ${repo_gits.length} repos: ${repositories_path}`);
		return repo_gits;
	}

	static findAllRepositoriesWithFullname(full_name) {
		var repo_gits = Repository.findAllRepositories();
		var repositories = [];
		console.log(`ℹ️ [info] [findAllRepositoriesWithFullname] Searching repos with fullname '${full_name}'`);
		let full_name_array = full_name.split("/");
		let repo_name = full_name_array[1];
		for (var dindex in repo_gits) {
			const repo = repo_gits[dindex];
			if (repo.indexOf(repo_name) == -1) continue;
			if ((repo.length > 1) && (repo.indexOf("/.git") !== -1 && repo.indexOf("/.git") == repo.length - 5)) {
				repositories.push(repo.replace("/.git", ""));
			}
		}
		console.log(`ℹ️ [info] [findAllRepositoriesWithFullname] Searching repos completed with ${repositories.length} repos.`);
		return repositories;
	}

	// if the folder in device is not latest, cal be deleted
	isNotLatest(path, latest) {
		return (path.indexOf("/" + latest) == -1);
	}

	purge_old_repos_with_full_name(repositories, name) {

		const deviceFolders = (repos) => {
			if (typeof (repos) === "undefined") return [];
			if (repos === null) return [];
			return repos
				.map((repo) => {
					let splitted = repo.split("/");
					return splitted.splice(0, splitted.length - 2).join("/");
				});
		};

		const getMostRecentDirectory = (repos) => {
			const files = orderRecentDirectories(repos);
			return files.length ? files[0] : undefined;
		};

		const orderRecentDirectories = (repos) => {
			return repos
				.filter((repo) => fs.lstatSync(repo).isDirectory())
				.map((repo) => ({ repo, mtime: fs.lstatSync(repo).mtime }))
				.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
		};

		const getDirectories = (source) => {
			return fs.readdirSync(source, { withFileTypes: true }) // lgtm [js/path-injection]
				.filter(dirent => dirent.isDirectory())
				.map(dirent => source + "/" + dirent.name);
		};

		let device_folders = deviceFolders(repositories);
		for (let index in device_folders) {
			let device_folder = device_folders[index];
			console.log(`🔨 [debug] [repository] device_folder ${device_folder}`);
			let all_in_device_folder = getDirectories(device_folder);
			console.log(`🔨 [debug] [repository] all_in_device_folder ${JSON.stringify(all_in_device_folder)}`);
			let latest_in_device_folder = getMostRecentDirectory(all_in_device_folder);
			if (typeof (latest_in_device_folder) === "undefined" || latest_in_device_folder === null) {
				continue;
			}
			console.log(`🔨 [debug] [repository] latest_in_device_folder ${JSON.stringify(latest_in_device_folder)}`);
			let latest_build_id_arr = latest_in_device_folder.toString().split("/");
			if (typeof (latest_build_id_arr) === "undefined" || latest_build_id_arr === null) {
				continue;
			}
			let latest_build_id = latest_build_id_arr[latest_build_id_arr.length - 1];
			console.log(`🔨 [debug] [repository] latest_build_id ${JSON.stringify(latest_build_id)} in device folder ${device_folder} parsing ${JSON.stringify(all_in_device_folder)}`);
			if ((typeof (latest_build_id) === "undefined") || (latest_build_id === "undefined")) {
				continue;
			}
			for (let dindex in all_in_device_folder) {
				let folder = all_in_device_folder[dindex];
				let canBeDeleted = this.isNotLatest(folder, latest_build_id);
				let repo_folder = getDirectories(folder)[0];
				if (canBeDeleted && (repo_folder.indexOf(name) !== -1)) {
					console.log(`ℹ️ [info] Purging old repo folder ${folder}`);
					fs.rmdir(folder, { recursive: true });
				}
			}

		}
	}

	validateSignature(signature, body, secret) {
		if ((typeof (secret) === "undefined") || (secret === null)) return true;
		let bare_signature = signature.replace("sha256=", "");
		let hmac = crypto.createHmac('sha256', secret).update(body).digest("base64");
		return (hmac === bare_signature) ? true : false;
	}

	process_hook(req) {
		
		let info = req.body;
		let repository = info.repository;

		if (typeof (repository) === "undefined") {
			console.log("🔆 [audit] Exiting, unknown webhook request: ", { info });
			return false;
		}

		var name = repository.name;
		var full_name = repository.full_name;

		console.log(`☣️ [debug] [process_hook] [spec] Repository Name ${name} and Fullname ${full_name} (searching by name)`);

		var repositories = Repository.findAllRepositoriesWithFullname(name);
		if (repositories.length == 0) {
			console.log(`⚠️ [warning] No repositories found with filter ${name}`);
			return false;
		}

		this.purge_old_repos_with_full_name(repositories, name);

		repositories = Repository.findAllRepositoriesWithFullname(name);
		console.log(`☣️ [debug] [process_hook] [spec] Repositories after purge: ${repositories}`);
		this.queue_updated_repos(repositories);
		return true;
	}

	queue_updated_repos(repositories) {
		for (let local_path of repositories) {
			let owner_id = sources.ownerIdFromPath(local_path);
			// If no source.secret is set in repository, ignore github secret
			sources.withRepository(info, local_path, (source_ids) => {
				if ((typeof (source_ids) === "undefined" || source_ids.length == 0)) {
					console.log(`[info] No sources to be queued with local_path ${local_path}`);
					return;
				}
				sources.list(owner_id, (success, repos) => {
					for (let source_id of source_ids) {
						console.log(`ℹ️ [info] Fetching matching devices for changed source_id ${source_id}`);
						let repo = repos[source_id];
						if (signature !== null) {
							if (!this.validateSignature(signature, info, repo.secret)) {
								console.log("☣️ [error] GitHub Secret validation failed for repo", { repo });
								continue; // next source_id, this onw is signed but signature does not compute
							}
						}
						this.devices.udidsWithSource(owner_id, source_id, (udids) => {
							console.log("udids with source", source_id, ":", udids);
							for (let udid of udids) {
								console.log(`ℹ️ [info] Adding device ${udid} with this source.`);
								if (typeof(this.queue) !== "undefined") {
									this.queue.add(udid, source_id, owner_id);
								} else {
									console.log(`[warning] no queue defined in ${process.env.ENVIRONMENT} environment`);
								}
							}
						});
					}
				});
			});
		}
	}
};
