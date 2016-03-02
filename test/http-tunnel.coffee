http = require 'http'
nodeTunnel = require 'node-tunnel'
Promise = require 'bluebird'
expect = require('chai').expect
tunnel = require '../'

N = 5
serverPort = 8080
tunnelPort = 3128
tunnelProxy = null
agent = null
server = null

createServer = ->
	Promise.fromCallback (cb) ->
		server = http.createServer (req, res) ->
			res.writeHead(200)
			res.end("response#{req.url}")
		server.listen(serverPort, cb)

createTunnelProxy = ->
	Promise.fromCallback (cb) ->
		tunnelProxy = nodeTunnel.createTunnel()
		tunnelProxy.listen(tunnelPort, cb)

makeRequest = (agent, i = 1, cb) ->
	reqOptions =
		port: serverPort
		path: "/#{i}"
		agent: agent

	req = http.request reqOptions, (res) ->
		res.on 'data', (data) ->
			expect(data.toString()).to.equal("response/#{i}")
		res.on 'end', ->
			cb?()

	req.end()
	return req

describe 'HTTP keepAlive Tunnel', ->
	@timeout(2500)

	beforeEach (done) ->
		createServer()
		.then(createTunnelProxy())
		.then(done)

	afterEach ->
		server.close()
		tunnelProxy.close()

	it 'should make tunneling requests', (done) ->
		agent = new tunnel.Agent
			proxy:
				host: 'localhost'
				port: tunnelPort
		agent.createConnection = tunnel.createConnection

		connections = 0
		for i in [0...N]
			makeRequest agent, i, ->
				done() if ++connections is N

	it 'should keep alive', (done) ->
		agent = new tunnel.Agent
			keepAlive: true
			proxy:
				host: 'localhost'
				port: tunnelPort
		agent.createConnection = tunnel.createConnection

		connections = 0
		for i in [0...N]
			makeRequest agent, i, ->
				done() if ++connections is N

	it 'should reuse socket', (done) ->
		agent = new tunnel.Agent
			keepAlive: true
			proxy:
				host: 'localhost'
				port: tunnelPort
		agent.createConnection = tunnel.createConnection

		savedSocket = null
		for i in [0...2]
			# A delay is induced here to 1. allow the connection to be
			# established and 2. give the socket pooling callbacks a chance to run
			do (i) ->
				setTimeout ->
					req = makeRequest(agent, i)
					req.on 'socket', (socket) ->
						if not savedSocket?
							savedSocket = socket
						else
							expect(socket).to.equal(savedSocket)
							done()
				, i * 200

	it 'should remove socket after timeout and use a new one', (done) ->
		socketTimeout = 500

		agent = new tunnel.Agent
			keepAlive: true
			proxy:
				host: 'localhost'
				port: tunnelPort
				timeout: socketTimeout
		agent.createConnection = tunnel.createConnection

		savedSocket = null
		for i in [0...2]
			do (i) ->
				setTimeout ->
					req = makeRequest(agent, i)
					req.on 'socket', (socket) ->
						if not savedSocket?
							savedSocket = socket
						else
							expect(socket).to.not.equal(savedSocket)
							done()
				, i * (socketTimeout * 2)

	it 'should throw error if tunnel cannot be established', (done) ->
		agent = new tunnel.Agent
			proxy:
				host: 'localhost'
				port: tunnelPort
			keepAlive: true
		agent.createConnection = tunnel.createConnection

		tunnelProxy.close ->
			req = makeRequest(agent)
			req.on 'error', (err) ->
				expect(err.statusCode).to.equal(500)
				expect(err).to.be.an.instanceof(tunnel.TunnelingError)
				done()

	it 'throw an error if tunnel server drops connection', (done) ->
		agent = new tunnel.Agent
			proxy:
				host: 'localhost'
				port: tunnelPort
			keepAlive: true
		agent.createConnection = tunnel.createConnection

		tunnelProxy.use (req, socket, head, next) ->
			socket.write('HTTP/1.0 402 Payment Required\r\n\r\n')
			socket.end()

		req = makeRequest(agent)
		req.on 'error', (err) ->
			expect(err.statusCode).to.equal(402)
			expect(err).to.be.an.instanceof(tunnel.TunnelingError)
			done()
