var promisify = require("promisify-node");
var fs = promisify(require("fs-extra"));
var path = require("path");
var Manifest = require("./manifest");
var Preflight = require("./preflight");
var Sources = require("./sources");
var Config = require("./config.js");

function Installer(config, destination) {
  this.config = config;
  this.registry = config.registry;
  this.host = config.host;
  this.destination = destination;
};

Installer.prototype.installDependencies = function() {
  var self = this;
  var manifest;

  // Start a promise chain to ensure errors are caught.
  return new Promise(function(accept, reject) {
    accept();
  }).then(function() {
    manifest = Manifest.read(self.config.manifest_file);

    return Preflight.resolve_dependencies(manifest.dependencies, self.registry, self.host);
  }).then(function(preflight) {
    var promises = [];

    Object.keys(preflight).forEach(function(package_name) {
      var versions = Object.keys(preflight[package_name]);

      if (versions.length > 1) {
        throw new Error("Your package and its dependencies require conflicting versions of the '" + package_name + "' package: " + versions.join(", ") + ". This dependency structure is currently unallowed at this time but will be allowed upon updates to the Solidity compiler. Please remove conflicting dependencies in the meantime.");
      }
    });

    Object.keys(manifest.dependencies).forEach(function(package_name) {
      var version_range = manifest.dependencies[package_name];
      promises.push(self.installPackage(package_name, version_range));
    });

    return Promise.all(promises);
  }).then(function() {
    // After all the immediate dependencies are installed, find all
    // of their dependencies and install them recursively.
    return Sources.findDirectories(self.config.installed_packages_directory);
  }).then(function(directories) {
    var promises = [];

    directories.forEach(function(directory) {
      var dependency_config = Config.default().with({
        working_directory: directory,
        base_dir: directory,
        host: self.host,
        registry: self.registry
      });
      var dependency_installer = new Installer(dependency_config, dependency_config.installed_packages_directory);
      promises.push(dependency_installer.installDependencies());
    });

    return Promise.all(promises);
  });
};

Installer.prototype.installPackage = function(package_name, version_range) {
  var self = this;
  var lockfileURI;
  var lockfile;
  var version;

  return self.registry.resolveVersion(package_name, version_range).then(function(v) {
    if (v == null) {
      throw new Error("Cannot find package '" + package_name + "' that satisfies the version range: " + version_range);
    }

    version = v;
    return self.registry.getLockfileURI(package_name, version_range);
  }).then(function(uri) {
    lockfileURI = uri;
    return self.host.get(lockfileURI);
  }).then(function(data) {
    lockfile = JSON.parse(data);

    var package_location = path.resolve(path.join(self.destination, package_name));
    var manifest_location = path.resolve(path.join(package_location, self.config.default_manifest_filename));
    var lockfile_location = path.resolve(path.join(package_location, self.config.default_lockfile_filename));
    var lockfile_uri_location = path.resolve(path.join(package_location, self.config.default_lockfile_uri_filename));

    var file_promises = [];

    // Add the sources
    Object.keys(lockfile.sources).forEach(function(relative_source_path) {
      var source_path = path.resolve(path.join(package_location, relative_source_path));
      var uri = lockfile.sources[relative_source_path];

      file_promises.push(self.saveURI(uri, source_path));
    });

    // Add the manifest
    file_promises.push(self.saveURI(lockfile.package_manifest, manifest_location));

    // Add the lockfile itself
    // This requests the lockfile again, but it's easy.
    file_promises.push(self.saveURI(lockfileURI, lockfile_location));

    // Save the URI of the lockfile for this version
    file_promises.push(fs.outputFile(lockfile_uri_location, lockfileURI));

    return Promise.all(file_promises);
  });
};

Installer.prototype.saveURI = function(uri, destination_path) {
  return this.host.get(uri).then(function(contents) {
    return fs.outputFile(destination_path, contents);
  });
};

module.exports = Installer;
