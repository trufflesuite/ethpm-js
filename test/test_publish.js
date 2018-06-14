var TestHelper = require('./lib/testhelper');
var EPM = require('../index.js');
var path = require("path");
var assert = require("assert");
var Sources = require("../lib/sources");

describe("Publishing", function() {
  var helper = TestHelper.setup({
    packages: [
      "custom-use-cases/owned-1.0.0",
      "custom-use-cases/owned-2.0.0",
      "custom-use-cases/eth-usd-oracle-1.0.0"
    ],
    compile: [
      "owned-1.0.0",
      "owned-2.0.0"
    ]
  });

  var owned;
  var eth_usd;

  before("setup variables once previous steps are finished", function() {
    owned = helper.packages["owned-1.0.0"];
    owned2 = helper.packages["owned-2.0.0"];
    eth_usd = helper.packages["eth-usd-oracle-1.0.0"];
  });

  it("published the correct lockfile, manifest file and source files", function() {
    this.timeout(25000);

    var lockfile;

    // Publish the package.
    return owned.package.publish(owned.contract_metadata).then(function() {
      // Now check the registry
      return helper.registry.getLockfileURI("owned", "1.0.0");
    }).then(function(lockfileURI) {
      return helper.host.get(lockfileURI);
    }).then(function(data) {
      lockfile = JSON.parse(data);

      assert.equal(lockfile.version, "1.0.0");
      //assert.deepEqual(lockfile.contracts, owned.contract_metadata);

      var promises = [];

      assert.equal(Object.keys(lockfile.sources).length, 3);

      Object.keys(lockfile.sources).forEach(function(relative_path) {
        var full_path = path.resolve(path.join(owned.package.config.base_path, relative_path));
        var sourceURI = lockfile.sources[relative_path];

        promises.push(helper.assertHostMatchesFilesystem(sourceURI, full_path));
      });

      return Promise.all(promises);
    });
  });

  it("recognizes x-* options in the manifest and includes them in lockfile", function() {
    this.timeout(25000);

    var lockfile;

    // Publish the package.
    return owned2.package.publish(owned2.contract_metadata).then(function() {
      // Now check the registry
      return helper.registry.getLockfileURI("owned", "2.0.0");
    }).then(function(lockfileURI) {
      return helper.host.get(lockfileURI);
    }).then(function(data) {
      lockfile = JSON.parse(data);

      assert.equal(lockfile["x-via"], "test-packager");
    });
  });

  it("correctly publishes packages with dependencies", function(){
    this.timeout(25000);

    // First install any dependencies.
    return eth_usd.package.install().then(function() {
      return Sources.findDirectories(eth_usd.package.config.installed_packages_directory);
    }).then(function(installed_packages) {
      installed_packages = installed_packages.map(function(dir) {
        return dir.replace(eth_usd.package.config.installed_packages_directory + path.sep, "");
      });

      assert.deepEqual(installed_packages, ["owned"], "Expected the `owned` dependency to be installed.");

      // Now publish it.
      return eth_usd.package.publish();
    }).then(function() {
      return helper.registry.getLockfileURI("eth-usd-oracle", "1.0.0");
    }).then(function(lockfileURI) {
      return helper.host.get(lockfileURI);
    }).then(function(data) {
      lockfile = JSON.parse(data);

      // TODO: Verify build dependencies are correct.
    });
  });

  // TODO: Test to ensure publishing errors when the package has a bad lockfile.
});
