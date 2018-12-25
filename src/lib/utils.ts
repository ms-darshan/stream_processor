import * as crypto from 'crypto';
import * as req from 'request';
import * as uuid from 'uuid/v4';
import * as fs from "fs";
import {spawn} from "child_process";
import { Request, Response, Router } from 'express';

import { UtilsType } from '../models';
import {ROOT_DIR, FORMULA} from "../settings";
import { Config } from '../config';
// import { Client } from "./db"; // This will be a cirular import, Don't use it here.

interface CommonResObject {
    status: String,
    code: String,
    data?: any,
    message?: String
}

let codes = {
    '200': 'OK',
    '110': 'Invalid or Missing Auth Token',
    '111': 'Blacklisted Client',
    '112': 'Incorrect Password',
    '113': 'CODE-RED: Invalid or Fake Client ID',
    '114': 'CODE-RED: Incorrect Client Secret',
    '115': 'Missing Access Token',
    '116': 'Invalid Refresh Token',
    '117': 'Incorrect Access Token',
    '118': 'Unsupported Client Type',
    '501': 'Unsupported Request Type',
    '119': 'Missing Payload',
    '120': 'Missing Client ID or Secret',
    '121': 'Your ID is not in system. Please contact your manager.',
    '122': 'Missing Refresh Token',
    '403': 'Forbidden. You do not have access to this resource',
    '410': 'Data Already Existent',
    '411': 'Data Non Existent',
    '601': 'Custom server error'
};

/* Utility functions for string */
const proto: any = String.prototype;
proto.rtrim = function(s: string) {
    if (s === undefined) {
        s = "\\s";
    }
    return this.replace(new RegExp("[" + s + "]*$"), "");
};

proto.ltrim = function(s: string) {
    if (s === undefined) {
        s = "\\s";
    }
    return this.replace(new RegExp("^[" + s + "]*"), "");
};
/* ----- end of utility for string ------ */

function applyRule(rule: any, data: any, prepend?: string): boolean|[boolean, string[]] {
    let validationMsgs: string[] = [];
    let valid: boolean = true;
	prepend = prepend || "";
    for (const r in rule) {
        const column = rule[r];
		let log_r: string = prepend + r;
        if (column.required && data[r] === undefined) {
            valid = false;
            console.log(`${log_r} is required`);
            validationMsgs.push(`${log_r} is required`);
        }
        switch (column.type) {
            case "enum": {
                if (data[r] !== undefined 
                    && column.in.indexOf(data[r]) === -1) {
                    valid = false;
                    console.log(`${log_r} data must be '${column.in}', got '${data[r]}' instead`);
                    validationMsgs.push(`${log_r} data must be '${column.in}', got '${data[r]}' instead`);
                }
                break;
			}
			case "array": {
				if (data[r] !== undefined 
                    && data[r].constructor != Array) {
                    valid = false;
                    console.log(`${log_r} must be of type array, got '${data[r]}' instead`);
                    validationMsgs.push(`${log_r} must be of type array, got '${data[r]}' instead`);
                }
                break;
			}
			case "object": {
				if(data[r] !== undefined && rule[r].properties) {
					let recursiveResult: any | [boolean, string[]] = applyRule(rule[r].properties, data[r], r + ".");
					if(!recursiveResult[0]) {
						valid = false;
						validationMsgs = validationMsgs.concat(recursiveResult[1]);
					}
				}
				break;
			}
            default: {
				if(data[r] !== undefined && (typeof data[r] !== column.type)) {
					if(!(column.allow_null && data[r] === null)) {
						valid = false;
						console.log(`${log_r} data must be of ${column.type}`);
						validationMsgs.push(`${log_r} data must be of ${column.type}`);
					}
                }
                break;
            }
        }
    }
    return [valid, validationMsgs];
    // return valid;
}

export let Utils: UtilsType = {
    applyRule,
    respond: (res: Response, data: any, code: string, message?: string) => {
        const sendData: CommonResObject = {
            code,
            data: {},
            message: "",
            status: "failure",
        };
        if (code === "200") {
            sendData.status = "success";
            sendData.data = data;
        } else {
            sendData.message = message;
        }

		res.json(sendData);
		// res.status(parseInt(code).json(sendData);
    },
    uuid(toHex: boolean = false): string {
        let uu  = "";
        const salt = new Date().getTime() + "";

		// uu = uuid(salt, uuid.DNS); // This is for uuid v5 as This would give same string for same salt and namespace
		uu = uuid(); // https://github.com/kelektiv/node-uuid#version-4

        if (toHex) {
            uu = Buffer.from(uu).toString("base64");
        }

        return uu;
    },
	/**
	 * Token generation based on crypto package
	 * If you are worried about uniquness visit below URL
	 * https://stackoverflow.com/questions/26066604/generating-unique-tokens-in-a-nodejs-crypto-token-authentication-environment
	 */
	uuid_crypto(length: number = 16, toHex: boolean = false): string {
		const buffer = crypto.randomBytes(length);

        if (toHex) {
            return buffer.toString("base64");
        }

		return buffer.toString("hex");
	},
    writeFile: (path: string, text: string, callback: Function) => {
        fs.writeFile(path, text, function (err) {
            if (err) {
                callback(err, null);
                return console.log(err);
            }

            console.log("The file was saved!");
            callback(null, true);
        });
    },

    restartServer: (app: any) => {
        let cmd: string = ROOT_DIR + "/src/shellUtils.sh";
        console.log("Restarting App...");
        let child: any = spawn(cmd, [FORMULA, "restart"]);

        child.on('error', (e: Error) => { console.log(e) });
        child.stdout.pipe(process.stdout);
        console.log("STARTED with PID:", child.pid);
	},

	sizeOf: (text: string | Object) => {
		let s: string = JSON.stringify(text);
		return ~-encodeURI(s).split(/%..|./).length
	},

	insertError: (err: any, user: string, data: any, key: string, action: string, organization: string): void => {
		let insert: Function = (zone: string) => {
			// let db = Client("mongo", "hogwarts", zone);
			let z: any = Config.DB.mongo.db[zone];
			if(!z) {
				z = Config.DB.mongo.db["default"];
			}
			let db = z["hogwarts"];
			db.collection('errors').insertOne({
				user: user,
				request: data,
				// error_data: error_data,
				timestamp: new Date().getTime(),
				organization: organization,
				key: key,
				action: action,
				error: err
			});
		};
		Utils.getZone(organization).then((zone: string) => {
			insert(zone);
		}).catch((err: Error) => {
			insert("default");
		});
	},
	
	whatIsIt: (data: any): string | boolean => {
        let stringConstructor = "test".constructor;
        let arrayConstructor = [].constructor;
        let objectConstructor = {}.constructor;

        try {
            if (data === null) {
                console.log("Data is null");
                return 'null';
            } else if (data === undefined) {
                return 'undefined';
            } else if (data.constructor === stringConstructor) {
                return "string";
            } else if (data.constructor === arrayConstructor) {
                return "array";
            } else if (data.constructor === objectConstructor) {
                return "object";
            } else if (!isNaN(data)) {
                return "number";
            } else {
                console.log("Unknown format");
                return false;
            }   
        } catch(err) {
            console.log("Exception while checking data type");
            return false;
        }   
    },  

	getZone: (organization: string): Promise<string> => {
		return new Promise((resolve, reject) => {
			let redis_client = Config.CACHE.db[Config.GLOBAL_CACHE_DB];
			redis_client.hget("zones", organization, function(err: any, zone: string) {
				if(err) {
					console.log("Error getting zone", organization, err);
					return reject(err);
				}
				console.log("Redis Zone: ", zone);
				resolve(zone || "default");
			});
		});
	},
	
	requestInfo: (request: any) => {
		if(request) {
			return {
				method: request.method,
				body: request.body,
				url: request.originalUrl
			}
		}
	},

	makeRequest: (req_type: string, url: string, headers: any, body?: any): Promise<any> => {
		return new Promise((resolve, reject) => {
			url = url.toUpperCase();
			if(!headers['content-type']) {
				headers['content-type'] = 'application/json';
			}
			let options: { [x: string]: any } = {
				url: url,
				headers: headers, 
				json: true 
			};
			let req_method: Function = req.get;
			switch(req_type) {
				case "GET":
					req_method = req.get;
					break;
				case "POST":
					req_method = req.post;
					if(body)
						options["body"] = body;
					break;
				case "PUT":
					req_method = req.put;
					if(body)
						options["body"] = body;
					break;
				case "DELETE":
					req_method= req.delete;
					if(body)
						options["body"] = body;
					break;
				default:
					reject("Provide correct request method");
					break;
			}

			req_method(options, (err: Error, resp: any, body: any ) => { // resp: req.Response
				if(err) {
					return reject(err);
				}
				return resolve(body);
			});
		});
	}
};
