var fs = require('fs-extra');
var path = require("path");
var Manifest = require("./manifest");
var Lockfile = require("./lockfile");
var Preflight = require("./preflight");
var Sources = require("./sources");
var Config = require("./config.js");
var Util = require("./util");

function Installer(config, destination) {
  this.config = config;
  this.registry = config.registry;
  this.host = config.host;
  this.destination = destination;
};

Installer.prototype.installDependencies = function(manifest) {
  var self = this;

  // Start a promise chain to ensure errors are caught.
  return new Promise(function(accept, reject) {
    accept();
  }).then(function() {

    if (manifest == null) {
      manifest = Manifest.read(self.config.manifest_file);
    }

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
  });
};

Installer.prototype.installPackage = function(package_name, version_range) {
  var self = this;
  var lockfileURI;
  var lockfile;
  var version;
  var manifest;
  var package_location;

  return Promise.resolve().then(function() {
    // If we have a URI, don't go to the registry.
    if (Util.isURI(version_range)) {
      return version_range;
    }

    return self.registry.getLockfileURI(package_name, version_range);
  }).then(function(uri) {
    lockfileURI = uri;
    return self.host.get(lockfileURI);
  }).then(function(data) {
    lockfile = JSON.parse(data);

    // Validate the lockfile before moving further.
    var results = Lockfile.validate(lockfile);

    if (results.errors.length > 0) {
      throw new Error("Could not install package `" + package_name + "`: Invalid package specification (" + results.errors[0].stack.replace("instance.", "") + ")");
    }

    // Create a manifest from the lockfile
    manifest = Manifest.fromLockfile(lockfile);

    package_location = path.resolve(path.join(self.destination, package_name));
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

    // Add the lockfile itself
    // This requests the lockfile again, but it's easy.
    file_promises.push(self.saveURI(lockfileURI, lockfile_location));

    // Save the URI of the lockfile for this version
    file_promises.push(fs.outputFile(lockfile_uri_location, lockfileURI));

    // Create and save the manifest
    file_promises.push(fs.outputFile(manifest_location, JSON.stringify(manifest, null, 2)));

    return Promise.all(file_promises);
  }).then(function() {
    // After this package is installed, use the manfest to install any dependencies.
    var dependency_config = Config.default().with({
      working_directory: package_location,
      base_dir: package_location,
      host: self.host,
      registry: self.registry
    });
    var dependency_installer = new Installer(dependency_config, self.destination);

    return dependency_installer.installDependencies();
  });
};

Installer.prototype.saveURI = function(uri, destination_path) {
  return this.host.get(uri).then(function(contents) {
    return fs.outputFile(destination_path, contents);
  });
};

module.exports = Installer;
