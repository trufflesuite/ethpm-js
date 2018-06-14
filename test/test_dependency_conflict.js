var TestHelper = require("./lib/testhelper");
var path = require("path");
var EPM = require('../index.js');
var dir = require("node-dir");
var assert = require("assert");
var fs = require("fs-extra");

describe("Dependency Conflict", function() {
  var helper = TestHelper.setup({
    packages: [
      "custom-use-cases/dependency-conflict-2.0.0",
      "custom-use-cases/owned-1.0.0",
      "custom-use-cases/owned-2.0.0",
      "custom-use-cases/eth-usd-oracle-1.0.0"
    ]
  });

  var conflict;
  var owned1;
  var owned2;
  var ethUSD;

  before("setup variables", function() {
    conflict = helper.packages["dependency-conflict-2.0.0"];
    owned1 = helper.packages["owned-1.0.0"];
    owned2 = helper.packages["owned-2.0.0"];
    ethUSD = helper.packages["eth-usd-oracle-1.0.0"]
  });

  before("published conflicting dependencies", function() {
    this.timeout(25000);

    return owned1.package.publish().then(function() {
      return owned2.package.publish();
    }).then(function() {
      // eth-usd-oracle has dependencies to install
      return ethUSD.package.install();
    }).then(function() {
      return ethUSD.package.publish();
    });
  });

  it("installs should fail during installation due to conflicting dependencies", function(done) {
    this.timeout(25000);

    conflict.package.install().then(function() {
      return done(new Error("This error shouldn't be evaluated because another error should have come before it."));
    }).catch(function(e) {
      assert(e.message.indexOf("Your package and its dependencies require conflicting versions of") >= 0, "Got an unexpected error: " + e.message);
      done();
    }).catch(done);
  });
});
