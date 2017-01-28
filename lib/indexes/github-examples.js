var path = require("path");
var ipfsd = require("ipfsd-ctl");
var IPFSHost = require("../hosts/ipfshost");
var MemoryRegistry = require("../registries/memoryregistry");
var fs = require("fs-extra");
var wget = require("wget-improved");
var parallel = require("async/parallel");
var series = require("async/series");
var whilst = require("async/whilst");
var eachSeries = require("async/eachSeries");

// These examples are ordered such that any package that depends on another in this list
// will come after the one it depends on (i.e., transferable depends on owned). We do this
// because we edit the lockfiles that contain deployed packages, which means we have to
// update dependency's build_dependencies to reference the new lockfiles.
var examples = [
  "owned",
  "transferable",
  "standard-token",
  "safe-math-lib",
  "piper-coin",
  "escrow",
  "wallet"
];

module.exports = {
  initialize: function(options, callback) {
    var self = this;

    if (typeof options == "function") {
      callback = options;
      options = {};
    }

    var lockfiles = {};
    var sourcefiles = {};
    var ipfs_daemon;
    var ipfs_api;
    var host;
    var registry;
    var lockfile_uris = {};

    series([
      // Download all lockfiles
      function(c) {
        var lockfiles_requests = {};

        examples.forEach(function(name) {
          lockfiles_requests[name] = self.get.bind(self, "/" + name + "/1.0.0.json");
        });

        parallel(lockfiles_requests, function(err, results) {
          if (err) return c(err);

          Object.keys(results).forEach(function(package_name) {
            lockfiles[package_name] = JSON.parse(results[package_name]);
          });

          c();
        });
      },
      // Download all source files
      function(c) {
        var sourcefile_requests = {};

        Object.keys(lockfiles).forEach(function(package_name) {
          var lockfile = lockfiles[package_name];

          Object.keys(lockfile.sources || {}).forEach(function(file_path) {
            file_path = "/" + package_name + "/" + file_path;
            sourcefile_requests[file_path] = self.get.bind(self, file_path);
          });
        });

        parallel(sourcefile_requests, function(err, results) {
          if (err) return c(err);

          sourcefiles = results;
          c();
        });
      },
      // Create host and registry
      function(c) {
        ipfsd.disposable(function (err, node) {
          if (err) return c(err);

          ipfs_daemon = node;

          node.startDaemon(function(err, ipfs) {
            ipfs_api = ipfs;

            host = new IPFSHost(ipfs_api.apiHost, ipfs_api.apiPort);

            registry = new MemoryRegistry();

            c();
          });
        });
      },
      // Put all source files on host
      function(c) {
        var puts = [];

        Object.keys(sourcefiles).forEach(function(sourcefile_path) {
          puts.push(host.putContents(sourcefiles[sourcefile_path]));
        });

        Promise.all(puts).then(function(results) {
          c();
        }).catch(c);
      },
      // Put all lockfiles on host and register versions
      // Do this serially so we can override build dependencies of lockfiles
      // that are edited.
      function(c) {
        var pushed_lockfiles = {};
        var package_names = Object.keys(lockfiles);

        eachSeries(package_names, function(package_name, finished) {
          var lockfile = lockfiles[package_name];

          // If we've specified a specific blockchain, override deployments to point to that blockchain.
          if (options.blockchain != null && lockfile.deployments != null && Object.keys(lockfile.deployments).length > 0) {
            var deployments = {};

            // This is naive, but will coerce down to a single blockchain, which is good enough for now.
            Object.keys(lockfile.deployments || {}).forEach(function(blockchain) {
              deployments[options.blockchain] = lockfile.deployments[blockchain];
            });

            lockfile.deployments = deployments;
          }

          // Override any build dependencies of previously uploaded lockfiles.
          Object.keys(lockfile.build_dependencies || {}).forEach(function(dependency_name) {
            if (pushed_lockfiles[dependency_name] != null) {
              lockfile.build_dependencies[dependency_name] = pushed_lockfiles[dependency_name];
            }
          });

          var raw_lockfile = JSON.stringify(lockfile, null, 2);

          host.putContents(raw_lockfile).then(function(uri) {
            pushed_lockfiles[package_name] = uri;
            finished();
          }).catch(finished);
        }, function(err) {
          if (err) return c(err);

          var registrations = [];

          package_names.forEach(function(package_name) {
            var uri = pushed_lockfiles[package_name];
            registrations.push(registry.register(package_name, "1.0.0", uri));
          });

          Promise.all(registrations).then(function(results) {
            c();
          }).catch(c);
        });
      }
    ], function(err) {
      if (err) return callback(err);

      callback(null, {
        host: host,
        registry: registry,
        examples: examples,
        ipfs_daemon: ipfs_daemon,
        ipfs_api: ipfs_api
      });
    });
  },

  get: function(examples_path, callback) {
    var options = {
      protocol: "https",
      host: "raw.githubusercontent.com",
      path: path.join("/ethpm/epm-spec/master/examples", examples_path),
      method: "GET"
    };

    var req = wget.request(options, function(res) {
      var content = '';
      if (res.statusCode === 200) {
        res.on('error', function(err) {
          callback(err);
        });
        res.on('data', function(chunk) {
          content += chunk;
        });
        res.on('end', function() {
          callback(null, content);
        });
      } else {
        callback(new Error('Unexpected server response ' + res.statusCode));
      }
    });

    req.end();
    req.on('error', function(err) {
      callback(err);
    });
  }
};
