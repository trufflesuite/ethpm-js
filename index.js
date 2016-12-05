var Installer = require("./lib/installer");
var Publisher = require("./lib/publisher");
var IPFSHost = require("./lib/hosts/ipfshost");
var MemoryRegistry = require("./lib/registries/memoryregistry");
var Config = require("./lib/config");
var promisify = require("promisify-node");
var fs = promisify(require("fs-extra"));
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
  install: function() {
    var installer = new Installer(this.config, this.config.installed_packages_directory);
    return installer.installDependencies();
  },

  installDependency: function(package_name, version_range) {
    var installer = new Installer(this.config, this.config.installed_packages_directory);
    return installer.installPackage(package_name, version_range);
  },

  // Publish the current package to the host and registry.
  // Contract metadata is also required for all contracts listed in the `contracts` portion of the manifest.
  // Returns a Promise.
  publish: function(contract_metadata) {
    contract_metadata = contract_metadata || {};

    var publisher = new Publisher(this.config.registry, this.config.host, contract_metadata);
    return publisher.publish(this.config);
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
    IPFS: IPFSHost
  }
});

module.exports = EthPM;
