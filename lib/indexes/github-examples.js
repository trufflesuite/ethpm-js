var path = require("path");
var ipfsd = require("ipfsd-ctl");
var IPFSHost = require("../hosts/ipfshost");
var MemoryRegistry = require("../registries/memoryregistry");
var fs = require("fs-extra");
var wget = require("wget-improved");
var parallel = require("async/parallel");
var series = require("async/series");
var whilst = require("async/whilst");

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
  initialize: function(callback) {
    var self = this;
    var lockfiles = {};
    var raw_lockfiles = {};
    var sourcefiles = {};
    var ipfs_server;
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
            raw_lockfiles[package_name] = results[package_name];
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
        ipfsd.disposableApi(function (err, ipfs) {
          if (err) return c(err);

          ipfs_server = ipfs;

          host = new IPFSHost({
            host: ipfs_server.apiHost,
            port: ipfs_server.apiPort
          });

          registry = new MemoryRegistry();

          c();
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
      function(c) {
        var puts = [];

        var package_names = Object.keys(lockfiles);

        // Make a copy of package_names.
        var stack = package_names.concat([]);

        package_names.forEach(function(package_name) {
          puts.push(host.putContents(raw_lockfiles[package_name]));
        });

        Promise.all(puts).then(function(URIs) {
          var registrations = [];

          package_names.forEach(function(package_name, index) {
            var uri = URIs[index];
            registrations.push(registry.register(package_name, "1.0.0", uri));
          });

          return Promise.all(registrations);
        }).then(function(results) {
          c();
        }).catch(c);
      }
    ], function(err) {
      if (err) return callback(err);

      callback(null, {
        host: host,
        registry: registry,
        examples: examples
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
