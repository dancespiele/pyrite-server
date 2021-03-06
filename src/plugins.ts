import { Request, Response } from "express";

import { Route } from "./route";
import { PyriteServer } from "./server";

import * as I from "./interfaces";

export class Plugins {
	constructor(private server: PyriteServer, private plugins: Array<I.Plugin>) {}

	public load(route: Route): void {
		const plugins = this.getByType("server");

		plugins.forEach((plugin: I.Plugin) => {
			route.pluginCallbacks[plugin.param] = plugin.load(route.target, route.method);
		});
	}

	public run(): void {
		const plugins = this.getByType("server");

		plugins.forEach((plugin: I.Plugin) => {
			plugin.run(this.server);
		});
	}

	public runMiddlewares(request: Request, response: Response, route: Route): Boolean {
		const middlewares = this.getByType("middleware");

		if (!middlewares) return true;

		return middlewares.some((plugin: I.Plugin): boolean => plugin.run(request, response, route));
	}

	public getByType(type: string) {
		return this.plugins.filter((plugin: I.Plugin) => plugin.type === type);
	}

	public getByParameter(paramName: string): I.Plugin|void {
		return this.plugins.find((plugin: I.Plugin) => plugin.param === paramName);
	}
}
