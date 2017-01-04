var ipfsAPI = require('ipfs-api')
var Readable = require('stream').Readable;
var URL = require("url");

function IPFSHost(host, port) {
  host = host || "localhost";
  prot = port || 5001;

  this.ipfs = ipfsAPI(host, port);
  this.notfound_timeout = 5000; // five seconds
}

IPFSHost.prototype.putContents = function(contents) {
  var self = this;

  return new Promise(function(accept, reject) {
    var stream = new Readable();
    stream.push(contents);
    stream.push(null);

    self.ipfs.util.addFromStream(stream, function(err, result) {
      if (err) return reject(err);
      accept("ipfs://" + result[0].hash);
    })
  });
}

IPFSHost.prototype.putFile = function(file) {
  var self = this;
  return new Promise(function(accept, reject) {
    self.ipfs.util.addFromFs(file, {recursive: false}, function(err, result) {
      if (err) return reject(err);
      accept("ipfs://" + result[0].hash);
    });
  })
};

IPFSHost.prototype.get = function(uri) {
  var self = this;
  return new Promise(function(accept, reject) {
    if (uri.indexOf("ipfs://") != 0) {
      return reject(new Error("Don't know how to resolve URI " + uri));
    }

    var timeout_id = setTimeout(function() {
      reject(new Error("Could not find object at hash '" + multihash + "' in " + self.notfound_timeout + "ms"));
    }, self.notfound_timeout);

    var hash = uri.replace("ipfs://", "");
    var multihash = hash;

    self.ipfs.files.cat(multihash, function(err, file) {
      if (err) return reject(err);

      var contents = "";

      file.on('data', function(chunk) {
        // Clear the timeout so we don't error, since we found data.
        clearTimeout(timeout_id);
        contents += chunk.toString();
      });

      file.on('end', function() {
        accept(contents);
      });

      file.on('error', function(e) {
        reject(e);
      });
    });
  });
};

module.exports = IPFSHost;
