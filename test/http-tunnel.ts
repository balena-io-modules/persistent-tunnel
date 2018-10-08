/*
	Copyright 2018 Resin.io Ltd.

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

		http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

import * as Promise from 'bluebird';
import { expect } from 'chai';
import * as http from 'http';
import * as _ from 'lodash';
import * as net from 'net';
import * as nodeTunnel from 'node-tunnel';

import * as tunnel from '../src';

const N = 5;
const serverPort = 8080;
const tunnelPort = 3128;
let tunnelProxy: nodeTunnel.Tunnel | null = null;
let agent: tunnel.Agent | null = null;
let server: http.Server | null = null;

const createServer = () =>
	Promise.fromCallback((cb) => {
		server = http.createServer((req, res) => {
			res.writeHead(200);
			res.end(`response${req.url}`);
		});
		server.listen(serverPort, cb);
	});

const createTunnelProxy = () =>
	Promise.fromCallback((cb) => {
		tunnelProxy = new nodeTunnel.Tunnel();
		tunnelProxy.listen(tunnelPort, cb);
	});

const makeRequest = function(agent: http.Agent, i: number = 1, cb?: () => void) {
	const reqOptions = {
		port: serverPort,
		path: `/${i}`,
		agent,
	};

	const req = http.request(reqOptions, (res) => {
		res.on('data', (data) =>
			expect(data.toString()).to.equal(`response/${i}`));
		res.on('end', () =>
			cb != null && cb());
	});

	req.end();
	return req;
};

describe('TypeScript', () => {
	describe('HTTP keepAlive Tunnel', function() {
		this.timeout(2500);

		beforeEach(() =>
			Promise.all([
				createServer(),
				createTunnelProxy(),
			]));

		afterEach((done) => {
			if (server != null) {
				server.close();
			}
			if (tunnelProxy != null) {
				tunnelProxy.close();
			}
			done();
		});

		it('should make tunneling requests', (done) => {
			agent = new tunnel.Agent({
				proxy: {
					host: 'localhost',
					port: tunnelPort,
				},
			});

			_.times(N, (i) =>
				makeRequest(agent!, i, () => i === (N - 1) && done()));
		});

		it('should keep alive', (done) => {
			agent = new tunnel.Agent({
				keepAlive: true,
				proxy: {
					host: 'localhost',
					port: tunnelPort,
				},
			});

			_.times(N, (i) =>
				makeRequest(agent!, i, () => i === (N - 1) && done()));
		});

		it('should reuse socket', function(done) {
			agent = new tunnel.Agent({
				keepAlive: true,
				proxy: {
					host: 'localhost',
					port: tunnelPort,
				},
			});

			let savedSocket: net.Socket | null = null;
			[ 0, 1 ].map((i) =>
				// A delay is induced here to 1. allow the connection to be
				// established and 2. give the socket pooling callbacks a chance to run
				setTimeout(() =>
						makeRequest(agent!, i)
						.on('socket', (socket) => {
							if (savedSocket == null) {
								savedSocket = socket;
							} else {
								expect(socket).to.equal(savedSocket);
								done();
							}
						}),
					i * 200));
		});

		it('should remove socket after timeout and use a new one', (done) => {
			const socketTimeout = 500;

			agent = new tunnel.Agent({
				keepAlive: true,
				proxy: {
					host: 'localhost',
					port: tunnelPort,
					timeout: socketTimeout,
				},
			});

			let savedSocket: net.Socket | null = null;
			[ 0, 1 ].map((i) =>
				setTimeout(() =>
						makeRequest(agent!, i)
						.on('socket', (socket) => {
							if (savedSocket == null) {
								return savedSocket = socket;
							} else {
								expect(socket).to.not.equal(savedSocket);
								done();
							}
						}),
					i * (socketTimeout * 2)));
		});

		it('should throw error if tunnel cannot be established', (done) => {
			agent = new tunnel.Agent({
				proxy: {
					host: 'localhost',
					port: tunnelPort,
				},
				keepAlive: true,
			});

			tunnelProxy!.close(() =>
				makeRequest(agent!)
				.on('error', (err: tunnel.TunnelingError) => {
					expect(err.statusCode).to.equal(500);
					expect(err).to.be.an.instanceof(tunnel.TunnelingError);
					done();
				}));
		});

		it('should throw an error if tunnel server drops connection', function(done) {
			agent = new tunnel.Agent({
				proxy: {
					host: 'localhost',
					port: tunnelPort,
				},
				keepAlive: true,
			});

			tunnelProxy!.use((_req, socket) => {
				socket.write('HTTP/1.0 402 Payment Required\r\n\r\n');
				socket.end();
			});

			makeRequest(agent)
			.on('error', (err: tunnel.TunnelingError) => {
				expect(err.statusCode).to.equal(402);
				expect(err).to.be.an.instanceof(tunnel.TunnelingError);
				done();
			});
		});

		it('should properly release socket if tunnel responds with a non 200 HTTP status', function(done) {
			// If the socket is not properly released the test should fail with a timeout
			this.timeout(1000);

			const httpRequest = http.request;

			(<any>http).request = (opts?: any, cb?: any) => {
				const req = httpRequest(opts, cb);
				if ((<any>req).method === 'CONNECT') {
					req.on('socket', (socket) =>
						socket.on('close', () => {
							// restore
							(<any>http).request = httpRequest;
							done();
						}));
				}
				return req;
			};

			agent = new tunnel.Agent({
				proxy: {
					host: 'localhost',
					port: tunnelPort,
				},
				keepAlive: true,
			});

			tunnelProxy!.use((_req, socket) => {
				socket.write('HTTP/1.0 402 Payment Required\r\n\r\n');
				socket.end();
			});

			makeRequest(agent)
			.on('error', (err: tunnel.TunnelingError) => {
				expect(err.statusCode).to.equal(402);
				expect(err).to.be.an.instanceof(tunnel.TunnelingError);
			});
		});
	});
});
