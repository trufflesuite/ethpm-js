var Manifest = require("./manifest");
var Sources = require("./sources");
var path = require("path");
var promisify = require("promisify-node");
var fs = promisify(require("fs-extra"));

function Publisher(registry, host, contract_metadata) {
  this.registry = registry;
  this.host = host;
  this.contract_metadata = contract_metadata || {};
};

Publisher.prototype.publish = function(config) {
  var self = this;

  var lockfile = {};
  var lockfileURI;
  var manifest;

  return new Promise(function(accept, reject) {
    // Place this in a promise so errors will be sent down the promise chain.
    manifest = Manifest.read(config.manifest_file);

    lockfile.lockfile_version = manifest.manifest_version;
    lockfile.package_name = manifest.package_name;
    lockfile.meta = {
      authors: manifest.authors,
      license: manifest.license,
      description: manifest.description,
      keywords: manifest.keywords,
      links: manifest.links
    };
    lockfile.version = manifest.version;

    accept();
  }).then(function() {
    return Sources.expand(manifest.sources, config.base_path);
  }).then(function(source_paths) {
    var promises = [];

    source_paths.forEach(function(source_path) {
      var promise = new Promise(function(accept, reject) {
        self.host.putFile(source_path).then(function(sourceURI) {
          var relative = "." + path.sep + path.relative(config.base_path, source_path);
          var obj = {};
          obj[relative] = sourceURI;
          accept(obj);
        }).catch(reject);
      });

      promises.push(promise);
    });

    return Promise.all(promises);
  }).then(function(source_objects) {

    lockfile.sources = source_objects.reduce(function(merged_obj, source_obj) {
      Object.keys(source_obj).forEach(function(key) {
        merged_obj[key] = source_obj[key];
      });
      return merged_obj;
    }, {});

    var promises = [];

    Object.keys(manifest.dependencies).forEach(function(dependency_name) {
      var lockfile_uri_location = path.join(config.installed_packages_directory, dependency_name, config.default_lockfile_uri_filename);
      promises.push(fs.readFile(lockfile_uri_location, "utf8").then(function(uri) {
        return [dependency_name, uri];
      }));
    });

    return Promise.all(promises);
  }).then(function(lockfile_uris) {

    lockfile.build_dependencies = {};

    lockfile_uris.forEach(function(tuple) {
      var dependency_name = tuple[0];
      var lockfile_uri = tuple[1];

      lockfile.build_dependencies[dependency_name] = lockfile_uri;
    });

    return self.host.putContents(JSON.stringify(lockfile));
  }).then(function(lockfileURI) {
    return self.registry.register(manifest.package_name, manifest.version, lockfileURI);
  });
}

module.exports = Publisher;
