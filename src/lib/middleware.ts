import { Request, Response } from "express";

// import { Config } from "../config";
import { Voldemort } from "./error";
import { Utils } from "./utils";
//import { JWT_SECRET } from "../settings";
import { IRequest } from "../models";
import { Client } from "./db";
import { ENVIRONMENT, FEEDDBNAME } from "../settings";

/**
 * Default error callback function for auth
 *
 * @param response Response
 * @return Error Voldemort
 */
function authCallback(response: Response) {
    throw new Voldemort("Unauthorized", 401);
    // return Utils.respond(response, '', '401', "Unauthorized");
}

export function authenticate(request: IRequest | any, response: Response, next: Function) {
	let authorization_token: string | any = request.headers.authorization || "";
    if (authorization_token) {
        try {
			const mongDb = Client("mongo", FEEDDBNAME[ENVIRONMENT]);
			const colctnObj: any  = mongDb.collection("sessions");
			let url = request.url;
			const userId  = url.split("/")[1];
			let query: any = {
				token: authorization_token,
				status: 1
			};

			colctnObj.find(query).toArray(function(err:any, docs:any) {
				if(err) {
					console.log("Exception fetching AuthInformation.", err);
					return Utils.respond(response, "Un Authorised.", 401);
				}
				if(docs.length>0) {
					request.auth    = authorization_token;
					request.company = docs[0].company;
					request.userid  = docs[0].user;
					next();
				}else {
					console.log(query);
					return Utils.respond(response, "Un Authorised.", 401);
				}
			});
        } catch(err) {
            console.log("Error in getting AuthInformation ", err);
            return authCallback(response);
        }
    } else {
		//authCallback(response);
		//Disabled Auth
		next();
	}
}

export function auth(wrapped: any, custom?: any,
                     callback: (response: Response) => void = authCallback): any {
    return function(req: Request, res: Response) {
        // console.log("Checking auth");
        let authenticated: boolean = false;
        if (custom !== undefined) {
            authenticated = custom(arguments);
        } else {
            if (req.headers.authorization) {
                // check for auth in db
                authenticated = true;
            }
        }
        if (!authenticated) {
            return callback(res);
        }
        const result = wrapped.apply(this, arguments);
        // console.log("Finished for auth");
        return result;
    };
}

export function exists(paramName: string, db: any, table: string, column: string, wrapped: Function): Function {
    return function(req: Request, res: Response) {
        const mongo = require("mongodb");
        try {
            const oId = new mongo.ObjectID(req.params[paramName]); // This might give error
            db.collection("events")
                .find({ _id: oId })
                .toArray()
                .then((data: any) => {
                    console.log(data);
                    if (data.length) {
                        const result = wrapped.apply(this, arguments);
                        console.log("Finished for exists");
                        return result;
                    } else {
                        Utils.respond(res, "", "422", `Wrong ${paramName}`);
                    }
                }).catch((err: Error) => {
                    Utils.respond(res, err, "500", "Not a valid " + paramName);
                });
        } catch (err) {
            throw new Voldemort("Not a valid " + paramName, 422);
        }
    };
}
