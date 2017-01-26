var _ = require("lodash");
var validate = require('jsonschema').validate;
var lockfile_spec = require("ethpm-spec/spec/release-lockfile.spec.json");

var V1 = {
  version: 1,
  validate: function(json) {
    return validate(json, lockfile_spec);
  },
  normalize: function(json) {
    // Add keys with default values if non-existent
    // (don't use this function for validation)
    var defaults = {
      authors: {},
      license: "",
      description: "",
      keywords: [],
      links: {},
      sources: null,
      dependencies: {}
    };

    json = _.merge(defaults, json);

    return json;
  },
  // fromLockfile: function(lockfile) {
  //   var meta = lockfile.meta || {};
  //   var sources = lockfile.sources || {};
  //
  //   var manifest = {
  //     manifest_version: this.version,
  //     package_name: lockfile.package_name,
  //     authors: meta.authors,
  //     version: lockfile.version,
  //     license: meta.license,
  //     description: meta.description,
  //     keywords: meta.keywords,
  //     links: meta.links,
  //     sources: Object.keys(sources),
  //     dependencies: lockfile.build_dependencies
  //   };
  //
  //   return manifest;
  // }
};

module.exports = V1;
