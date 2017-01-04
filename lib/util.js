var URL = require("url");

var Util = {
  isURI: function(url) {
    return URL.parse(url).protocol != null;
  }
};

module.exports = Util;
