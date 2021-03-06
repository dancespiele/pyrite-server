import { Request, Response } from "express";

import { Plugins } from "./plugins";

import * as I from "./interfaces";

export class Route {
	pluginCallbacks: {[key: string]: Function};
	targetMethod: I.Method;
	befores: Array<I.Middleware>;
	plugins: Plugins|void;

	constructor(
		private server: any,
		public target: any,
		public method: I.RouteConfig
	) {
		this.targetMethod = target[method.methodName];
		this.targetMethod.path = method.path || `/${this.targetMethod.name}`;
		this.targetMethod.alias = this.targetMethod.alias || this.targetMethod.name;
		this.plugins = server.plugins;
		this.pluginCallbacks = {};

		console.log(`Loading route: ${method.action.toUpperCase()} ${this.target.path}${this.targetMethod.path}`);

		this.befores = this.addBeforeMiddlewares();

		this.befores.push(this.mainMiddleware.bind(this));
	}

	private addBeforeMiddlewares(): Array<I.Middleware> {
		let befores: Array<I.Middleware> = [];

		if (this.targetMethod && this.targetMethod.before) befores = befores.concat(this.targetMethod.before);
		if (this.target.beforeAll) befores = this.target.beforeAll.concat(befores);

		return befores;
	}

	private addAfterMiddlewares(result: any): any {
		if (!this.targetMethod.after) return result;

		return this.targetMethod.after.reduce((prev: Function, next: Function) => next(prev), result);
	}

	private mainMiddleware(request: Request, response: Response): void {
		if (this.plugins && this.plugins.runMiddlewares(request, response, this)) return;

		let parameters: Array<any> = this.getOrder(request, response);

		console.log(`${this.method.action.toUpperCase()} ${this.target.path}${this.targetMethod.path}`);

		new Promise((resolve) => {
			resolve(this.targetMethod.call(this.target, ...parameters));
		})
		.then(this.addAfterMiddlewares.bind(this))
		.then((methodResult: any) => {
			if (methodResult && methodResult.error && methodResult.status) return response.status(methodResult.status).send({ error: methodResult.error });
			response.status(this.targetMethod.status || 200).send(methodResult);
		})
		.catch((error: any) => {
			console.error(error);
			response.status(error.status || 500).send(error ? error.error : error);
		});
	}

	private setTypes(parameters: any): Array<I.Parameter> {
		const routes = this.targetMethod.path.split("/");

		let paramNumber = 0;

		routes.forEach((route: string) => {
			if (route[0] === ":") {
				const key = route.substring(1, route.length);
				parameters[key] = this.method.types[paramNumber](parameters[key]);
				paramNumber++;
			}
		});

		return parameters;
	}

	private getOrder(request: Request, response: Response): Array<any> {
		const parameters = this.targetMethod.parameters;

		if (!parameters) return [request, response];
		if (this.method.types.length) this.setTypes(request.params);

		return parameters.map((parameter: I.Parameter): any => {
			const plugin = this.plugins ? this.plugins.getByParameter(parameter.param) : false;

			if (parameter.param === "request") return this.getDescendantProp(request, parameter.key);
			if (parameter.param === "response") return this.getDescendantProp(response, parameter.key);
			if (parameter.key) return this.getDescendantProp((<any>request)[parameter.param], parameter.key);
			if (plugin) return this.pluginCallbacks[plugin.param].bind(this, request, response);

			return (<any>request)[parameter.param];
		});
	}

	private getDescendantProp(obj: any, desc?: string): any {
		if (!desc) return obj;

		const arr = desc.split(".");

		while (arr.length && (obj = obj[arr.shift() || '']));

		return obj;
	}
}
