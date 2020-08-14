var IPFS = require("ipfs-mini");
var request = require("request");
var Readable = require('stream').Readable;
var URL = require("url");
var fs = require("fs");

function IPFSHost(host, port, protocol) {
  this.host = host || "localhost";
  this.port = port || 5001;
  this.protocol = protocol || "http";

  this.ipfs = new IPFS({
    host: this.host,
    port: this.port,
    protocol: this.protocol
  });
}

IPFSHost.prototype.putContents = function(contents) {
  var self = this;

  return new Promise(function(accept, reject) {
    self.ipfs.add(contents, (err, result) => {
      if (err) return reject(err);
      accept("ipfs://" + result);
    });
  });
}

IPFSHost.prototype.putFile = function(file) {
  var self = this;

  return new Promise(function(accept, reject) {
    fs.readFile(file, "utf8", function(err, data) {
      if (err) return reject(err);

      self.putContents(data).then(accept).catch(reject);
    });
  });
};

IPFSHost.prototype.get = function(uri) {
  var self = this;
  return new Promise(function(accept, reject) {
    if (uri.indexOf("ipfs://") != 0) {
      return reject(new Error("Don't know how to resolve URI " + uri));
    }

    var hash = uri.replace("ipfs://", "");

    var path = 'api/v0/cat/' + hash;
    var processedUrl = `${self.protocol}://${self.host}:${self.port}/${path}`;

    request(processedUrl, function(error, response, body) {
      if(error) {
        reject(error);
      } else if (response.statusCode !== 200) {
        reject(new Error(`Unknown server response ${response.statusCode} when downloading hash ${hash}`));
      } else {
        accept(body);
      };
    });
  });
};

module.exports = IPFSHost;
