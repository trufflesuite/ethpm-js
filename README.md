# Ethereum Package Manager / Javascript

[![Join the chat at https://gitter.im/ethpm/Lobby](https://badges.gitter.im/ethpm/Lobby.svg)](https://gitter.im/ethpm/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

### Overview

This package provides utilities for publishing and consuming Ethereum packages based on the [Ethereum Package Manager specification](https://github.com/ethpm/epm-spec). It is meant to be integrated directly into development tools to support their use of the Ethereum Package Management ecosystem.

### Usage

```javascript
// Require and configure EthPM relative to a package location on disk.
// `host` and `registry` must conform to Javascript Host and Registry interface.
// A "host" is a service that holds the files, like IPFS. A "registry" is a
// service that records package versions that have been published and their
// associated lockfile on the host.
var EthPM = require("ethpm");
var config = EthPM.configure(package_directory, host, registry);

// Install a single package into the current package, denoted by name and version.
// Returns a promise.
EthPM.installDependency(config, package_name, version_range);

// Install all dependencies of the current package.
// Returns a promise.
EthPM.installPackage(config);

// Publish the current package.
// Returns a promise.
// `contract_metadata` is information about published contracts you'd like include
// in this package. See lockfile spec for more information.
EthPM.publishPackage(config, contract_metadata);
```

### Running Tests

```
$ npm test
```

### Contributors

Initial author: Tim Coulter ([@tcoulter](https://github.com/tcoulter))

This is a joint effort by Truffle, Populus, Dapple and Eris.
