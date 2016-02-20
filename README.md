# persistent-tunnel

HTTP Agent for tunneling proxies with persistent sockets

## Motivation

This tunneling agent combines the latest http.Agent with a custom `createConnection` function
that returns the socket of an established tunnel.

Inspired from

* [http.Agent on nodejs/node#master](https://github.com/nodejs/node/commit/9bee03aaf2d8137a5e490150e759750ccdc65202)
* [koichik/node-tunnel](https://github.com/koichik/node-tunnel)

## Use cases

### Simple tunneling

```javascript
var tunnel = require('persistent-tunnel');

var tunnelingAgent = new tunnel.Agent({
  proxy: {
    host: 'localhost',
    port: 3128
  }
});
tunnelingAgent.createConnection = tunnel.createConnection;

var req = http.request({
  host: 'example.com',
  port: 80,
  agent: tunnelingAgent
});
```

### Simple tunneling with persistent tunnels

```javascript
var tunnel = require('persistent-tunnel');

var tunnelingAgent = new tunnel.Agent({
  keepAlive: true   // create persistent sockets over tunnel
  proxy: {
    host: 'localhost',
    port: 3128
  },
});
tunnelingAgent.createConnection = tunnel.createConnection;

var req = http.request({
  host: 'example.com',
  port: 80,
  agent: tunnelingAgent
});
```

### Simple tunneling with persistent tunnels that expire after a timeout

```javascript
var tunnel = require('persistent-tunnel');

var tunnelingAgent = new tunnel.Agent({
  keepAlive: true,
  proxy: {
    host: 'localhost',
    port: 3128
    timeout: 2000 // tunnel sockets close after 2s of inactivity
  },
});
tunnelingAgent.createConnection = tunnel.createConnection;

var req = http.request({
  host: 'example.com',
  port: 80,
  agent: tunnelingAgent
});
```

TODO
----
* https support
* proxy authorization

Support
-------

If you're having any problem, please [raise an issue](https://github.com/resin-io/persistent-tunnel/issues/new) on GitHub and the Resin.io team will be happy to help.

## License

Licensed under the [MIT](https://github.com/resin-io/persistent-tunnel/blob/master/LICENSE) license.
