var semver = require("semver");

function MemoryRegistry() {
  this.packages = {};
};

MemoryRegistry.prototype.getAllVersions = function(package_name, callback) {
  var self = this;
  return new Promise(function(accept, reject) {
    if (!self.packages[package_name]) {
      return accept([]);
    }
    accept(Object.keys(self.packages[package_name]).sort());
  });
}

MemoryRegistry.prototype.resolveVersion = function(package_name, version_range) {
  return this.getAllVersions(package_name).then(function(versions) {
    // This can be optimized.
    var max = null;

    versions.forEach(function(version) {
      if (semver.satisfies(version, version_range)) {
        if (max == null || semver.gte(version, max)) {
          max = version;
        }
      }
    });

    return max;
  });
};

MemoryRegistry.prototype.getLockfileURI = function(package_name, version_range) {
  var self = this;
  return this.resolveVersion(package_name, version_range).then(function(version) {
    if (version == null) {
      throw new Error("Cannot find package '" + package_name + "' that satisfies the version range: " + version_range);
    }

    return self.packages[package_name][version];
  });
};

MemoryRegistry.prototype.register = function(package_name, version, lockfileURI) {
  var self = this;
  return new Promise(function(accept, reject) {
    if (self.packages[package_name] && self.packages[package_name][version]) {
      return reject(new Error("Version " + version + " already exists for package " + package_name));
    }

    if (!self.packages[package_name]) {
      self.packages[package_name] = [];
    }

    self.packages[package_name][version] = lockfileURI;
    accept();
  });
};

module.exports = MemoryRegistry;
