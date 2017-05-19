var fs = require("fs");
var V1 = require("./manifests/v1");

var Manifest = {
  getInterpreter: function(manifest_version) {
    var interpreter = V1;

    if (manifest_version == null) return interpreter;

    // This could be slightly more clever by tacking on a "V" onto the version and
    // requiring that file (and catching the error if the require fails). Will do that
    // if this gets too unruly.
    switch (manifest_version) {
      case 1:
        interpreter = V1;
        break;
      default:
        if (manifest_version == null) {
          // do nothing; use default
        } else {
          throw new Error("Unknown manifest version " + manifest_version);
        }
        break;
    }

    return interpreter;
  },
  read: function(file) {
    var json = fs.readFileSync(file);
    json = JSON.parse(json);

    var interpreter = this.getInterpreter(json.manifest_version);

    interpreter.validate(json);

    return interpreter.normalize(json);
  },
  fromLockfile: function(lockfile) {
    // TODO: Match up lockfile versions with manifest versions somehow.
    var interpreter = this.getInterpreter();
    var manifest = interpreter.fromLockfile(lockfile);

    interpreter.validate(manifest);

    manifest = interpreter.normalize(manifest);

    return manifest;
  }
};

module.exports = Manifest;
