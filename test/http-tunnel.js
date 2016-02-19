var http = require('http');
var nodeTunnel = require('node-tunnel');
var Promise = require('bluebird');
var expect = require('chai').expect;

var tunnelAgent = require('../').Agent;

var serverPort = 8080;
var tunnelPort = 3128;

var N = 5;

var server;
var tunnel;
var agent;

function createServer() {
  return Promise.fromCallback(function(cb) {
    server = http.createServer(function(req, res) {
      res.writeHead(200);
      res.end('response' + req.url);
    });
    server.listen(serverPort, cb);
  });
}

function createTunnel() {
  return Promise.fromCallback(function(cb) {
    tunnel = nodeTunnel.createTunnel();
    tunnel.listen(tunnelPort, cb);
  });
}

var connections;
function makeRequest(agent, i, cb) {
  var reqOptions = {
    port: serverPort,
    path: '/' + i,
    agent: agent
  };

  var req = http.request(reqOptions, function(res) {
    res.on('data', function(data) {
      expect(data.toString()).to.equal('response/' + i);
    });

    res.on('end', function() {
      if (cb && ++connections === N) {
        cb();
      }
    });
  });
  req.end();
  return req;
}

describe('HTTP keepAlive Tunnel', function() {
  this.timeout(2500);

  beforeEach(function(done) {
    createServer()
    .then(createTunnel())
    .then(done);
  });

  afterEach(function() {
    server.close();
    tunnel.close();
  });

  it('should make tunneling requests', function(done) {
    agent = new tunnelAgent({
      proxy: {
        host: 'localhost',
        port: tunnelPort
      }
    });

    connections = 0;
    for (var i = 0; i < N; i++) {
      var req = makeRequest(agent, i, done);
    }
  });

  it('should keep alive', function(done) {
    agent = new tunnelAgent({
      keepAlive: true,
      proxy: {
        host: 'localhost',
        port: tunnelPort
      }
    });
    connections = 0;
    for (var i = 0; i < N; i++) {
      var req = makeRequest(agent, i, done);
    }
  });

  it('should reuse socket', function(done) {
    var savedSocket;

    agent = new tunnelAgent({
      keepAlive: true,
      proxy: {
        host: 'localhost',
        port: tunnelPort,
      },
    });

    connections = 0;
    for (var i = 0; i < 2; i++) {
      (function(idx, done) {
        // A delay is induced here to 1. allow the connection to be
        // established and 2. give the socket pooling callbacks a chance to run
        setTimeout(function() {
          var req = makeRequest(agent, idx);
          req.on('socket', function(socket) {
            if (!savedSocket) {
              savedSocket = socket;
            } else {
              expect(socket).to.equal(savedSocket);
              done();
            }
          });
        }, idx * 200);
      })(i, done);
    }
  });

  it('should remove socket after timeout and use a new one', function(done) {
    var savedSocket;
    var socketTimeout = 500;

    agent = new tunnelAgent({
      keepAlive: true,
      maxSockets: Infinity,
      proxy: {
        host: 'localhost',
        port: tunnelPort,
        timeout: socketTimeout
      },
    });

    connections = 0;
    for (var i = 0; i < 2; i++) {
      (function(idx, done) {
        setTimeout(function() {
          var req = makeRequest(agent, idx);
          req.on('socket', function(socket) {
            if (!savedSocket) {
              savedSocket = socket;
            } else {
              expect(socket).to.not.equal(savedSocket);
              done();
            }
          });
        }, i * (socketTimeout * 2));
      })(i, done);
    }
  });

  it('should throw error if tunnel cannot be established', function(done) {
    agent = new tunnelAgent({
      proxy: {
        host: 'localhost',
        port: tunnelPort,
      },
      keepAlive: true,
      maxSockets: Infinity
    });

    tunnel.close(function() {
      connections = 0;
      var req = makeRequest(agent, 0);
      req.on('error', function(err) {
        console.log('Error: ', err.message);
        done();
      });
    });
  });

  it('throw an error if tunnel server drops connection', function(done) {
    agent = new tunnelAgent({
      proxy: {
        host: 'localhost',
        port: tunnelPort,
      },
      keepAlive: true,
      maxSockets: Infinity
    });

    tunnel.use(function(req, socket, head, next) {
      socket.write('HTTP/1.0 402 Payment Required\r\n\r\n');
      socket.end();
    });

    connections = 0;
    var req = makeRequest(agent, 0);
    req.on('error', function(err) {
      console.log('Error: ', err.message);
      done();
    });
  });

});
