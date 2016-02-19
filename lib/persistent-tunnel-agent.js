var net = require('net');
var http = require('http');
var extend = require('util-extend');
var assert = require('assert');
var NodeAgent = require('./_http_agent');

function createTunnelConnection(options, cb) {
  var proxyOptions = extend({}, options.proxy);

  var connectOptions = {
    method: 'CONNECT',
    host: proxyOptions.host || 'localhost',
    port: proxyOptions.port || 3128,
    path: options.host + ':' + options.port,
    agent: false
  };

  var req = http.request(connectOptions);
  req.once('connect', onConnect);
  req.once('error', onError);
  req.end();

  function onConnect(res, socket, head) {
    socket.removeAllListeners();

    if (res.statusCode === 200) {
      assert.equal(head.length, 0);
      if (proxyOptions.timeout) {
        socket.setTimeout(proxyOptions.timeout, function() {
          socket.destroy();
          socket.emit('agentRemove');
        });
      }
      return cb(null, socket);
    } else {
      var err = new Error('tunneling socket could not be established, statusCode=' + res.statusCode);
      err.code = 'ECONNRESET';
      return cb(err);
    }
  }

  function onError(err) {
    var error = new Error('tunneling socket could not be established, cause=' + err.message);
    error.code = 'ECONNRESET';
    return cb(error);
  }

}

NodeAgent.Agent.prototype.createConnection = createTunnelConnection;

module.exports.Agent = NodeAgent.Agent;
