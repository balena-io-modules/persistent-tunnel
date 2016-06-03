net = require 'net'
http = require 'http'
NodeAgent = require '../vendor/_http_agent'
TypedError = require 'typed-error'

module.exports.TunnelingError = class TunnelingError extends TypedError
module.exports.Agent = NodeAgent.Agent
module.exports.createConnection = (options, cb) ->
	proxyOptions = options.proxy ? {}
	connectOptions =
		method: 'CONNECT'
		host: proxyOptions.host ? 'localhost'
		port: proxyOptions.port ? 3128
		path: "#{options.host}:#{options.port}"
		agent: false

	onError = (err, res) ->
		cause = res?.statusCode ? err.message
		error = new TunnelingError("tunneling socket could not be established: #{cause}")
		error.statusCode = res?.statusCode ? 500
		cb(error)

	onConnect = (res, socket, head) ->
		if res.statusCode is 200
			if proxyOptions.timeout?
				socket.setTimeout proxyOptions.timeout, ->
					socket.destroy()
			cb(null, socket)
		else
			onError(null, res)

	req = http.request(connectOptions)
	req.once('connect', onConnect)
	req.once('error', onError)
	req.end()
