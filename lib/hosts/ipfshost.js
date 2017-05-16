var ipfsAPI = require('ipfs-api');
var wget = require("wget-improved");
var Readable = require('stream').Readable;
var URL = require("url");

function IPFSHost(host, port, protocol) {
  this.host = host || "localhost";
  this.port = port || 5001;
  this.protocol = protocol || "http";

  this.ipfs = ipfsAPI(this.host, this.port, {protocol: this.protocol});
  //this.notfound_timeout = 30000; // 60 seconds
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

    // var timeout_id = setTimeout(function() {
    //   reject(new Error("Could not find object at hash '" + multihash + "' in " + self.notfound_timeout + "ms"));
    // }, self.notfound_timeout);

    var hash = uri.replace("ipfs://", "");
    var multihash = hash;

    // self.ipfs.files.cat(multihash, function(err, file) {
    //   if (err) return reject(err);
    //
    //   var contents = "";
    //
    //   file.on('data', function(chunk) {
    //     // Clear the timeout so we don't error, since we found data.
    //     clearTimeout(timeout_id);
    //     contents += chunk.toString();
    //   });
    //
    //   file.on('end', function() {
    //     accept(contents);
    //   });
    //
    //   file.on('error', function(e) {
    //     reject(e);
    //   });
    // });

    var options = {
      protocol: self.protocol,
      host: self.host,
      port: self.port,
      path: '/api/v0/cat/' + hash,
      method: 'GET'
    };

    var req = wget.request(options, function(res) {
      var content = '';
      if (res.statusCode === 200) {
        res.on('error', reject);
        res.on('data', function(chunk) {
          content += chunk;
        });
        res.on('end', function() {
          accept(content);
        });
      } else {
        reject(new Error("Unknown server response " + res.statusCode + " when downloading hash " + hash));
      }
    });

    req.end();
    req.on('error', reject);
  });
};

module.exports = IPFSHost;
