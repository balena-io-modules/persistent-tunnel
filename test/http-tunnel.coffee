###
	Copyright 2016 Balena Ltd.

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

		http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
###

http = require 'http'
nodeTunnel = require 'node-tunnel'
Promise = require 'bluebird'
expect = require('chai').expect

tunnel = require '../src'

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
		tunnelProxy = new nodeTunnel.Tunnel()
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

describe 'CoffeeScript', ->
	describe 'HTTP keepAlive Tunnel', ->
		@timeout(2500)

		beforeEach ->
			createServer()
			.then(createTunnelProxy())

		afterEach ->
			server.close()
			tunnelProxy.close()

		it 'should make tunneling requests', (done) ->
			agent = new tunnel.Agent
				proxy:
					host: 'localhost'
					port: tunnelPort

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

			tunnelProxy.close ->
				req = makeRequest(agent)
				req.on 'error', (err) ->
					expect(err.statusCode).to.equal(500)
					expect(err).to.be.an.instanceof(tunnel.TunnelingError)
					done()

		it 'should throw an error if tunnel server drops connection', (done) ->
			agent = new tunnel.Agent
				proxy:
					host: 'localhost'
					port: tunnelPort
				keepAlive: true

			tunnelProxy.use (req, socket, head, next) ->
				socket.write('HTTP/1.0 402 Payment Required\r\n\r\n')
				socket.end()

			req = makeRequest(agent)
			req.on 'error', (err) ->
				expect(err.statusCode).to.equal(402)
				expect(err).to.be.an.instanceof(tunnel.TunnelingError)
				done()

		it 'should properly release socket if tunnel responds with a non 200 HTTP status', (done) ->
			# If the socket is not properly released the test should fail with a timeout
			@timeout(1000)

			http.requestOrig = http.request
			http.request = ->
				req = http.requestOrig(arguments...)
				if req.method is 'CONNECT'
					req.on 'socket', (socket) ->
						socket.on 'close', ->
							# restore
							http.request = http.requestOrig
							done()
				return req

			agent = new tunnel.Agent
				proxy:
					host: 'localhost'
					port: tunnelPort
				keepAlive: true

			tunnelProxy.use (req, socket, head, next) ->
				socket.write('HTTP/1.0 402 Payment Required\r\n\r\n')
				socket.end()

			req = makeRequest(agent)
			req.on 'error', (err) ->
				expect(err.statusCode).to.equal(402)
				expect(err).to.be.an.instanceof(tunnel.TunnelingError)
