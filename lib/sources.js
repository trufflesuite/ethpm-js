var dir = require("node-dir");
var glob = require("glob");
var fs = require("fs");
var each = require("async/each");
var path = require("path");

var Sources = {

  expand: function(list, basePath) {
    var self = this;
    var paths = [];

    return new Promise(function(accept, reject) {
      each(list, function(source_path, finished) {
        var matches = [];

        // If we have a glob...
        if (glob.hasMagic(source_path)) {
          self.expandGlob(source_path, basePath).then(function(result) {
            paths = paths.concat(result);
          }).then(finished).catch(finished);
          return;
        }

        fs.stat(source_path, function(err, stats) {
          if (err) return finished(err);

          // If it's a directory, recursively get all children and grandchildren
          // and add them to the list.
          if (stats.isDirectory()) {
            self.expandDirectory(source_path, basePath).then(function(result) {
              paths = paths.concat(result);
            }).then(finished).catch(finished);
            return;
          }

          if (stats.isFile()) {
            // If it's a file, just add it to the list.
            paths.push(source_path);
            return finished();
          }

          // In the rare case it's neither a file nor directory, error.
          return finished(new Error("Unknown file type at path " + source_path));
        });
      }, function(err) {
        if (err) return reject(err);
        accept(paths);
      });
    });
  },

  expandGlob: function(source_path, basePath) {
    var self = this;
    return new Promise(function(accept, reject) {
      glob(source_path, {
        cwd: basePath
      }, function(err, matches) {
        if (err) return reject(err);
        accept(matches);
      });
    }).then(function(matches) {
      return matches.map(function(match) {
        return path.resolve(path.join(basePath, match));
      });
    }).then(function(matches) {
      return self.expand(matches, basePath);
    });
  },

  expandDirectory: function(source_path, basePath) {
    source_path = path.resolve(path.join(basePath, source_path));
    return new Promise(function(accept, reject) {
      dir.files(source_path, function(err, files) {
        if (err) return reject(err);
        accept(files);
      });
    });
  },

  findDirectories: function(basePath) {
    return new Promise(function(accept, reject) {
      glob("./*", {
        cwd: basePath
      }, function(err, matches) {
        if (err) return reject(err);
        matches = matches.map(function(match) {
          return path.join(basePath, match);
        });
        accept(matches);
      });
    });
  }

};

module.exports = Sources;
