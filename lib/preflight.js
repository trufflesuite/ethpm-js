var Util = require('./util');
var whilst = require("async/whilst");
var fs = require("fs-extra");
var path = require("path");

var Preflight = {
  // Given a list of manifest dependencies, find all dependencies (even
  // dependencies of dependencies) and list their lockfiles here.
  resolve_dependencies: function(dependencies, registry, host) {
    // Turn object into a stack
    var stack = [];
    var promises = [];

    var promises = Object.keys(dependencies).map(function(package_name) {
      var version_range = dependencies[package_name];

      // Support dependencies that are URIs.
      if (Util.isURI(version_range)) {
        // Make a promise out of the URI.
        return Promise.resolve(version_range);
      }

      return registry.getLockfileURI(package_name, version_range);
    });

    return Promise.all(promises).then(function(uris) {

      stack = uris.map(function(uri) {
        return [uri, [""]];
      });

      return new Promise(function(accept, reject) {
        var resolved = {};

        whilst(function() {
          return stack.length > 0;
        }, function(finished) {
          var current = stack.shift();
          var lockfileURI = current[0];
          var dependency_chain = current[1];
          var version;

          return host.get(lockfileURI).then(function(data) {
            var lockfile = JSON.parse(data);

            var package_name = lockfile.package_name;
            var version = lockfile.version;

            if (resolved[package_name] == null) {
              resolved[package_name] = {};
            }

            if (resolved[package_name][version] == null) {
              resolved[package_name][version] = {
                lockfile: lockfile,
                used_by: []
              };
            }

            resolved[package_name][version].used_by.push(dependency_chain);

            Object.keys(lockfile.build_dependencies || {}).forEach(function(key) {
              var uri = lockfile.build_dependencies[key];
              stack.push([uri, dependency_chain.concat([package_name])]);
            });

            finished();

          }).catch(finished);

        }, function(err) {
          if (err) return reject(err);
          accept(resolved);
        });
      });
    });
  },

  // Go through installed packages looking for all artifacts (contract_types and deployments).
  // Note that at this point, we don't allow multiple versions to be installed, which means that
  // we don't need to filter the results based on the semver version ranges within the containing
  // package's ethpm.json. We will when we do allower multiple versions later on.
  find_artifacts: function(installed_packages_directory, filter) {
    return new Promise(function(accept, reject) {
      fs.readdir(installed_packages_directory, function(err, directories) {
        if (err) {
          return accept([]);
        }

        accept(directories);
      });
    }).then(function(directories) {
      var lockfile_paths = directories.map(function(directory) {
        var expected_lockfile_path = path.resolve(path.join(installed_packages_directory, directory, "lock.json")); // Use constant somewhere (config?)

        return new Promise(function(accept, reject) {
          fs.readFile(expected_lockfile_path, "utf8", function(err, body) {
            if (err) return reject(err);
            accept(body);
          });
        });
      });

      return Promise.all(lockfile_paths);
    }).then(function(raw_lockfiles) {
      return raw_lockfiles.map(function(data) {
        return JSON.parse(data);
      });
    }).then(function(lockfiles) {
      var results = {};

      // Filter out lockfiles that aren't direct dependencies of this package.
      if (filter != null) {
        lockfiles = lockfiles.filter(function(lockfile) {
          return filter[lockfile.package_name] != null;
        });
      }

      // Return artifacts for direct dependencies.
      lockfiles.forEach(function(lockfile) {
        var package_name = lockfile.package_name;
        var version = lockfile.version;

        var deployments = lockfile.deployments || {};
        var contract_types = lockfile.deployments || {};

        var has_deployments = Object.keys(deployments).length > 0;
        var has_contract_types = Object.keys(contract_types).length > 0;

        if (!has_deployments && !has_contract_types) {
          return;
        }

        if (results[package_name] == null) {
          results[package_name] = {
            version: version
          };
        }

        if (has_deployments) {
          results[package_name].deployments = lockfile.deployments;
        }

        if (has_contract_types) {
          results[package_name].contract_types = lockfile.contract_types;
        }
      });

      return results;
    });
  }
};

module.exports = Preflight;
