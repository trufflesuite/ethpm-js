var request = require("request");
var inherits = require("util").inherits;
var IPFSHost = require("./ipfshost");

inherits(IPFSHostWithLocalReader, IPFSHost);

function IPFSHostWithLocalReader(host, port, protocol) {
  IPFSHost.call(this, host, port, protocol);
}

IPFSHostWithLocalReader.prototype.get = function(uri) {
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

module.exports = IPFSHostWithLocalReader;
