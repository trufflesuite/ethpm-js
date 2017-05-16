var wget = require("wget-improved");
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
    var multihash = hash;

    var options = {
      protocol: self.protocol,
      host: self.host,
      path: '/ipfs/' + hash,
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

module.exports = IPFSHostWithLocalReader;
