var ipfsd = require('ipfsd-ctl')
var EPM = require("../../index.js");
var Config = require("../../lib/config");
var IPFSHost = require("../../lib/hosts/ipfshost");
var MemoryRegistry = require("../../lib/registries/memoryregistry");
var Manifest = require("../../lib/manifest.js");

var fs = require('fs-extra');
var path = require("path");
var solc = require("solc");
var dir = require("node-dir");
var each = require("async/each");
var temp = require("temp").track();
var assert = require("assert");

function Helper() {
  this.ipfs_server = null;
  this.host = null;
  this.registry = null;
  this.packages = {};
};

Helper.prototype.assertHostMatchesFilesystem = function(sourceURI, source_path) {
  var self = this;
  var source_file_contents;

  return fs.readFile(source_path, "utf8").then(function(contents) {
    source_file_contents = contents;
  }).then(function() {
    return self.host.get(sourceURI)
  }).then(function(sourceURI_contents) {
    assert.equal(sourceURI_contents, source_file_contents);
  });
};

Helper.prototype.assertFilesMatch = function(expected, actual) {
  return Promise.all([
    fs.readFile(expected, "utf8"),
    fs.readFile(actual, "utf8")
  ]).then(function(results) {
    assert.equal(results[0], results[1]);
  });
};

var TestHelper = {
  setup: function(packages_to_setup) {
    var package_paths = packages_to_setup.packages;
    var compile = packages_to_setup.compile || [];

    var helper = new Helper();

    before("set up ipfs server and registry", function(done) {
      // This code that sets up the IPFS server has widely varying runtimes...
      this.timeout(20000);

      ipfsd.disposableApi(function (err, ipfs) {
        if (err) return done(err);

        helper.ipfs_server = ipfs;

        helper.host = new IPFSHost(helper.ipfs_server.apiHost, helper.ipfs_server.apiPort);
        helper.registry = new MemoryRegistry();

        done(err);
      });
    });

    package_paths.forEach(function(package_path) {
      package_path = package_path.split("/");
      package_path = [__dirname, "../", "../"].concat(package_path);
      var package_name = package_path[package_path.length - 1];

      var original_package_path = path.resolve(path.join.apply(path, package_path));

      // This is only used for epm-spec examples (as of the writing of this comment)
      var lockfile_path = path.resolve(path.join(original_package_path, "1.0.0.json"));

      var package_data = {
        package: null,
        contract_metadata: {},
        package_path: ""
      };
      helper.packages[package_name] = package_data;

      before("create temporary directory", function(done) {
        var temp_path = temp.mkdirSync("epm-test-");
        fs.copy(original_package_path, temp_path, {}).then(function() {
          package_data.package_path = temp_path;
          done();
        }).catch(done);
      });

      before("create ethpm.json file from lockfile if needed", function(done) {
        var epmjson_path = path.resolve(path.join(package_data.package_path, "ethpm.json"));

        // See if there's an ethpm.json there already.
        fs.stat(epmjson_path, function(err, stat) {
          if (err) return done(err);
          if (stat.isFile()) return done();

          // Doesn't exist, so let's create it from the lockfile.
          fs.readFile(lockfile_path, "utf8", function(err, body) {
            if (err) return done(err);
            var lockfile = JSON.parse(body);
            var manifest = Manifest.fromLockfile(lockfile);

            fs.writeFile(epmjson_path, JSON.stringify(manifest), "utf8", done);
          });
        });
      });

      before("set up config", function() {
        package_data.package = new EPM(path.resolve(package_data.package_path), helper.host, helper.registry);
      });

      before("generate contract metadata", function(done) {
        this.timeout(5000);

        if (compile.indexOf(package_name) < 0) return done();

        var sources = {};

        dir.files(package_data.package.config.contracts_directory, function(err, files) {
          if (err) return done(err);

          each(files, function(file, finished) {
            fs.readFile(file, "utf8").then(function(contents) {
              sources[file] = contents;
              finished();
            }).catch(finished)
          }, function(err) {
            if (err) return done(err);

            var output = solc.compile({sources: sources}, 1);

            Object.keys(output.contracts).forEach(function(contract_name) {
              var contract = output.contracts[contract_name];
              package_data.contract_metadata[contract_name] = {
                abi: JSON.parse(contract.interface),
                bytecode: contract.bytecode,
                runtime_bytecode: contract.runtimeBytecode,
                compiler: {
                  version: solc.version(),
                }
              };
            });

            done();
          });
        });
      });
    });

    return helper;
  }
};

module.exports = TestHelper;
