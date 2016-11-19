var Installer = require("./lib/installer");
var Publisher = require("./lib/publisher");
var IPFSHost = require("./lib/hosts/ipfshost");
var Config = require("./lib/config");
var promisify = require("promisify-node");
var fs = promisify(require("fs-extra"));
var path = require("path");
var _ = require("lodash");

var EPM = {
  installPackage: function(config) {
    var installer = new Installer(config, config.installed_packages_directory);
    return installer.installDependencies();
  },

  installDependency: function(config, package_name, version_range) {
    var installer = new Installer(config, config.installed_packages_directory);
    return installer.installPackage(package_name, version_range);
  },

  // Publish a package given a config object that represents a specific manifest file, host and registry.
  // Contract metadata is also required for all contracts listed in the `contracts` portion of the manifest.
  // Returns a Promise.
  publishPackage: function(config, contract_metadata) {
    var publisher = new Publisher(config.registry, config.host, contract_metadata);
    return publisher.publish(config);
  },

  configure: function(directory, host, registry) {
    return Config.default().with({
      working_directory: directory,
      base_dir: directory,
      host: host,
      registry: registry
    });
  },

  init: function(directory, options) {
    options = options || {};

    var json = require(path.resolve(path.join(__dirname, "templates", "epm.json")));

    json = _.cloneDeep(json);
    json = _.merge(json, options);

    return fs.writeFile(path.join(directory, "epm.json"), "utf8");
  },

  hosts: {
    IPFS: IPFSHost
  }
};

module.exports = EPM;
