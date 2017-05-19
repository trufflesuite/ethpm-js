var V1 = require("./lockfiles/v1");
var fs = require("fs");

var Lockfile = {
  getInterpreter: function(lockfile_version) {
    var interpreter = V1;

    if (lockfile_version == null) return interpreter;

    // This could be slightly more clever by tacking on a "V" onto the version and
    // requiring that file (and catching the error if the require fails). Will do that
    // if this gets too unruly.
    switch (parseInt(lockfile_version)) {
      case 1:
        interpreter = V1;
        break;
      default:
        if (lockfile_version == null) {
          // do nothing; use default
        } else {
          throw new Error("Unknown lockfile version " + lockfile_version);
        }
        break;
    }

    return interpreter;
  },
  read: function(file) {
    var json = fs.readFileSync(file);
    json = JSON.parse(json);

    var interpreter = this.getInterpreter(json.lockfile_version);

    interpreter.validate(json);

    return interpreter.normalize(json);
  },
  validate: function(json) {
    var interpreter = this.getInterpreter(json.lockfile_version);
    return interpreter.validate(json);
  }
};

module.exports = Lockfile;
