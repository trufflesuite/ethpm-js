var Util = require('./util');
var whilst = require("async/whilst");

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


};

module.exports = Preflight;
