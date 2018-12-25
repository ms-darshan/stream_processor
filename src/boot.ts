import * as bodyParser from "body-parser";
import * as express from "express";
import * as request from 'request';
import * as fs from "fs";

import app from "./app";
import { Config } from "./config";
import { logger } from "./lib/logger";
import { DATABASES, DBINIT, APP_CONFIG, ROOT_DIR, ALLOW_HEADERS, ALLOW_CORS } from "./settings";
import { KAFKASERVER, ENVIRONMENT, CACHE } from "./settings";
import { unhandledPromiseHandler } from "./lib/error";

import * as utils from "./lib/utils"; // To make sure string utilities loads first


function createDbConnections(): Promise<any> {
	return new Promise((resolve, reject) => {
		let idx: number = 0;
		let dbLen: number = 0;

		for (let dbType in DBINIT) {
			dbLen += DBINIT[dbType].length;
		}

		if(dbLen == 0){
			// return callback(true);
			return resolve(true);
		}

		for (let dbType in DBINIT) {
			if (!(dbType in DATABASES)) {
				console.log(dbType, "not found in config Databases");
				// return callback(false);
				return reject(false);
			}
			for (let i in DBINIT[dbType]) {
				let [zone, dbName] = DBINIT[dbType][i].split('.');
				// console.log(dbType, zone, dbName, DATABASES[dbType][zone][dbName]);
				if (!(dbName in DATABASES[dbType][zone])) {
					console.log(dbName, "is not in", dbType, "zone", zone);
					// callback(false);
					reject(false);
					return;
				}
				Config.DB[dbType].connect(zone, DATABASES[dbType][zone][dbName], (res: boolean) => {
					if (res) {
						idx += 1;
						if (idx === dbLen) {
							// callback(true);
							resolve(true);
						}
					} else {
						console.log(dbName, "DB", zone, "zone", dbType, "Type is unable to connect.");
						reject(false);
					}
				});
			}
		}
	});
}

function connectToCache(): Promise<any> {
	console.log('Trying to connect with cache');
	return new Promise((resolve, reject) => {
		for(let i in CACHE) {
			Config.CACHE.connect(CACHE[i], (_v: boolean) => {
				if(!_v)
					return reject(false);
				resolve(true);
			})
		}
	});
}

function createKafkaProducer(): Promise<any> {
	return new Promise((resolve, reject) => {
		let kafkaServr = KAFKASERVER[ENVIRONMENT];
		console.log("Kafka broker", kafkaServr);
		Config.kafkaproducer.connect(kafkaServr, (res: boolean) => {
			console.log('Kafka server connection status is ' + res);
			if(res)
				resolve(true);
			else
				reject(false);
		});
	});
}

let initHeaders: express.RequestHandler | express.ErrorRequestHandler = (req: express.Request, res: express.Response, next: Function) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);

	next();
}

function initKeyFolder() {
	try {
		let dir: string = ROOT_DIR + '/.keys';

		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
	} catch (e) {
		console.log("Error creating folder: ", e);
		return false;
	}
	return true;
}

export function init(callback: Function){

		console.log("INIT KEYS DIR.. ");
		let booting: Promise<any>[] = [createDbConnections(), connectToCache(), createKafkaProducer()];
		Promise.all(booting).then((result: boolean[]) => {
			unhandledPromiseHandler();

			app.use(initHeaders);
			app.use(bodyParser.json());
			app.use(logger());
			callback(false, app);
		}).catch((err: any) => {
			console.log("Booting ERR:", err);
			callback(err, app);
		});
}
