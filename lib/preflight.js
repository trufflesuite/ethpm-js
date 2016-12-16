var whilst = require("async/whilst");

var Preflight = {
  // Given a list of manifest dependencies, find all dependencies (even
  // dependencies of dependencies) and list their lockfiles here.
  resolve_dependencies: function(dependencies, registry, host) {
    // Turn object into a stack
    var stack = Object.keys(dependencies).reduce(function(arr, package_name) {
      var version_range = dependencies[package_name];
      arr.push([package_name, version_range, [""]]);
      return arr;
    }, []);

    return new Promise(function(accept, reject) {

      var resolved = {};

      whilst(function() {
        return stack.length > 0;
      }, function(finished) {
        var current = stack.shift();
        var package_name = current[0];
        var version_range = current[1];
        var dependency_chain = current[2];
        var version;

        registry.resolveVersion(package_name, version_range).then(function(v) {
          if (v == null) {
            throw new Error("Cannot find package '" + package_name + "' that satisfies the version range: " + version_range);
          }
          version = v;
          return registry.getLockfileURI(package_name, version_range);
        }).then(function(lockfileURI) {
          return host.get(lockfileURI);
        }).then(function(data) {
          var lockfile = JSON.parse(data);

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

          lockfile.build_dependencies
        }).then(finished).catch(finished);

      }, function(err) {
        if (err) return reject(err);
        accept(resolved);
      });
    });
  }
};

module.exports = Preflight;
