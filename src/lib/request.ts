import * as express from "express";
import { Request, Response } from "express";

import { Voldemort } from "../lib/error";
import { ResourceHandler, Indexable } from "../models";
import { Utils } from "./utils";
import { IRequest } from "../models";

// const expressRouter: (options?: express.RouterOptions | undefined) => express.Router = express.Router;
const expressRouter: any = express.Router;

export function wrap_class(cls: any, fun: any) {
    return (req: any, res: any) => {
        let obj:any = new cls();
        obj.initialize(req, res);
        return obj[fun](req, res);
    }
}

/**
 * https://www.sitepoint.com/javascript-decorators-what-they-are/
 */
export function handler(target: any, name: any, descriptor: any) {
    const original: Function = descriptor.value;

    if (typeof original === 'function') {
        descriptor.value = function(...args: any[]) {
            // console.log(`Arguments: ${args}`);
            try {
                target.initialize(...args);
                const result: any = original.apply(target, args);
                // console.log(`Result: ${result}`);
                return result;
            } catch (e) {
                console.log(`Error: ${e}`);
                throw e;
            }   
        }   
    }   

    return descriptor;
}

export function route(context: any) {
    return function(req: IRequest, res: Response, next: any) {
        let method = req.method.toLowerCase();
        let handler = context[method];

        if (typeof handler !== "function") {
            throw new Voldemort("Method not allowed", 405);
        }
        return handler.call(context, req, res, next);
    }
}

export class BaseHandler extends Indexable {

    public static route() {
        let Construct = this;
        let instance = new Construct();

        return function(request: IRequest, response: Response, next: any) {
            let method: string = (typeof request.method == 'string') ? request.method.toLowerCase() : '';
            let handler: Function = instance[method];

            if (typeof handler !== "function") {
                throw new Voldemort("Method not allowed", 405);
            } else {
                const result = handler.call(instance, request, response, next);
                return result;
            }
        }
    }
}

export let router = expressRouter(); // No need of this for now, but to add custom functionalities in future
