var Preflight = require("./lib/preflight");
var Installer = require("./lib/installer");
var Publisher = require("./lib/publisher");
var IPFSHost = require("./lib/hosts/ipfshost");
var IPFSHostWithLocalReader = require("./lib/hosts/ipfshostwithlocalreader");
var MemoryRegistry = require("./lib/registries/memoryregistry");
var Config = require("./lib/config");

var fs = require('fs-extra');
var path = require("path");
var _ = require("lodash");

function EthPM(directory, host, registry) {
  this.host = host || new IPFSHost();
  this.registry = registry || new MemoryRegistry();

  this.config = Config.default().with({
    working_directory: directory,
    base_dir: directory,
    host: host,
    registry: registry
  });
};

_.extend(EthPM.prototype, {
  install: function(manifest) {
    var installer = new Installer(this.config, this.config.installed_packages_directory);
    return installer.installDependencies(manifest);
  },

  installDependency: function(package_name, version_range) {
    var installer = new Installer(this.config, this.config.installed_packages_directory);
    return installer.installPackage(package_name, version_range);
  },

  // Publish the current package to the host and registry.
  // Contract metadata is also required for all contracts listed in the `contracts` portion of the manifest.
  // Returns a Promise.
  publish: function(contract_types, deployments, manifest) {
    var publisher = new Publisher(this.config.registry, this.config.host);
    return publisher.publish(this.config, contract_types, deployments, manifest);
  },

  installed_artifacts: function() {
    var manifest = {};

    try {
      manifest = Manifest.read(this.config.manifest_file);
    } catch (e) {
      // Do nothing with the error.
    }

    return Preflight.find_artifacts(this.config.installed_packages_directory, manifest.dependencies);
  }
});

_.extend(EthPM, {

  // deprecated
  configure: function(directory, host, registry) {
    return new EthPM(directory, host, registry);
  },

  init: function(directory, host, registry, options) {
    options = options || {};

    var json = require(path.resolve(path.join(__dirname, "templates", "epm.json")));

    json = _.cloneDeep(json);
    json = _.merge(json, options);

    return fs.writeFile(path.join(directory, "epm.json"), "utf8").then(function() {
      return new EthPM(directory, host, registry);
    });
  },

  hosts: {
    IPFS: IPFSHost,
    IPFSWithLocalReader: IPFSHostWithLocalReader
  }
});

module.exports = EthPM;
