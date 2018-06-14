var TestHelper = require("./lib/testhelper");
var path = require("path");
var EPM = require('../index.js');
var dir = require("node-dir");
var assert = require("assert");
var fs = require("fs-extra");

describe("Install", function() {
  var helper = TestHelper.setup({
    packages: [
      "custom-use-cases/owned-1.0.0",
      "custom-use-cases/eth-usd-oracle-1.0.0"
    ],
    compile: [
      "owned-1.0.0"
    ]
  });

  var owned;
  var eth_usd;

  before("setup variables once previous steps are finished", function() {
    owned = helper.packages["owned-1.0.0"];
    eth_usd = helper.packages["eth-usd-oracle-1.0.0"];
  });

  before("published owned for use as a dependency", function() {
    this.timeout(25000);

    return owned.package.publish(owned.contract_metadata);
  });

  it("installs eth-usd correctly with owned as a dependency", function() {
    this.timeout(25000);

    var dependency_path = path.resolve(path.join(eth_usd.package.config.installed_packages_directory, "owned"));

    return eth_usd.package.install().then(function() {
      return new Promise(function(accept, reject) {
        dir.files(dependency_path, function(err, files) {
          if (err) return reject(err);
          accept(files);
        });
      });
    }).then(function(files) {
      var assertions = [];

      assert.equal(files.length, 6); // three contracts, their epm.json, their lock.json and lock.uri

      var lockfile = fs.readFileSync(path.join(dependency_path, "lock.json"), "utf8");
      lockfile = JSON.parse(lockfile);

      Object.keys(lockfile.sources).forEach(function(relative_file_path) {
        var expected_example_path = path.join(owned.package.config.working_directory, relative_file_path);
        var actual_path = path.join(dependency_path, relative_file_path);

        assertions.push(helper.assertFilesMatch(expected_example_path, actual_path));
      });

      // TODO: assert contents of lockfile.

      return Promise.all(assertions);
    });
  });

  // TODO: Test to ensure installation errors when installing a package that has a bad lockfile.
});
