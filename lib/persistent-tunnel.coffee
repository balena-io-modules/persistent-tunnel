net = require 'net'
http = require 'http'
NodeAgent = require '../vendor/_http_agent'

createTunnelConnection = (options, cb) ->
	proxyOptions = options.proxy ? {}
	connectOptions =
		method: 'CONNECT'
		host: proxyOptions.host ? 'localhost'
		port: proxyOptions.port ? 3128
		path: "#{options.host}:#{options.port}"
		agent: false

	onConnect = (res, socket, head) ->
		socket.removeAllListeners()

		if res.statusCode is 200
			if proxyOptions.timeout?
				socket.setTimeout proxyOptions.timeout, ->
					socket.destroy()
					socket.emit('agentRemove')

			cb(null, socket)
		else
			error = new Error("tunneling socket could not be established, statusCode=#{res.statusCode}")
			error.code = 'ECONNRESET'
			cb(error)

	onError = (err) ->
		error = new Error("tunneling socket could not be established, cause=#{err.message}")
		error.code = 'ECONNRESET'
		cb(error)

	req = http.request(connectOptions)
	req.once('connect', onConnect)
	req.once('error', onError)
	req.end()

module.exports.Agent = NodeAgent.Agent
module.exports.createConnection = createTunnelConnection
