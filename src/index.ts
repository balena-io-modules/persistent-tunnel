/*
	Copyright 2018 Balena Ltd.

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

import * as http from 'http';
import * as net from 'net';
import { TypedError } from 'typed-error';

export class TunnelingError extends TypedError {
	public statusCode?: number;
}

export interface ProxyOptions {
	proxy?: {
		host?: string;
		port?: number | string;
		timeout?: number;
	};
}

export interface AgentOptions extends ProxyOptions, http.AgentOptions {}

export interface CreateConnectionOptions extends ProxyOptions {
	host: string;
	port: string;
}

export class Agent extends http.Agent {
	constructor(opts?: AgentOptions) {
		super(opts);
	}

	public createConnection(
		options: CreateConnectionOptions,
		callback: (err?: Error, res?: net.Socket) => void,
	): void {
		const proxyOptions = options.proxy != null ? options.proxy : {};
		const connectOptions = {
			method: 'CONNECT',
			host: proxyOptions.host || 'localhost',
			port: proxyOptions.port || 3128,
			path: `${options.host}:${options.port}`,
			agent: false,
		};

		const onError = (err?: Error, res?: http.IncomingMessage) => {
			let cause;
			let code = 500;
			if (err != null) {
				cause = err.message;
			}
			if (res != null && res.statusCode != null) {
				cause = code = res.statusCode;
			}
			const error = new TunnelingError(
				`tunneling socket could not be established: ${cause}`,
			);
			error.statusCode = code;
			callback(error);
		};

		const onConnect = (res: http.IncomingMessage, socket: net.Socket) => {
			if (res.statusCode === 200) {
				if (proxyOptions.timeout != null) {
					socket.setTimeout(proxyOptions.timeout, socket.destroy);
				}
				callback(undefined, socket);
			} else {
				onError(undefined, res);
			}
		};

		const req = http.request(connectOptions);
		req.once('connect', onConnect);
		req.once('error', onError);
		req.end();
	}
}
