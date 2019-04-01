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

var req = http.request({
  host: 'example.com',
  port: 80,
  agent: tunnelingAgent
});
```

## Configuration

### `keepAlive` setting

When `keepAlive` is set to `true`, socket pooling / reuse
is enabled by the HTTP Agent. In addition to managing the pool,
the HTTP Agent calls `setKeepAlive()` on each pooled socket so
that TCP KeepAlive packets are sent over the established connection
in small intervals. Any intermediate TCP Load Balancers / Proxies
along the tunnel connection should detect the TCP KeepAlive packets
and keep the connection alive.

### `timeout` setting

When `timeout` is set, the connection will get severed if no data has
been transfered over the socket for the specified time. TCP KeepAlive
packets do not count as data. The `timeout` setting is useful for making sure
that idle sockets will eventually get `destroy()`'ed and release their
resources.

If no `timeout` value is set, the pooled tunneling sockets will be kept alive forever.

In any case, if a tunnel connection gets dropped for any reason, the underlying
socket will emit an error that [will result in it being removed from the HTTP
Agent pool (and its resources released, too).

TODO
----
* https support
* proxy authorization

Support
-------

If you're having any problem, please [raise an issue](https://github.com/balena-io-modules/persistent-tunnel/issues/new) on GitHub and the Balena team will be happy to help.

## License

Licensed under the [MIT](https://github.com/balena-io-modules/persistent-tunnel/blob/master/LICENSE) license.
