import { Request, Response } from "express";

import { Config } from '../config';
import { IRequest } from "../models";
import { Utils } from "./utils";

const DB: any = Config.DB;

export let Client = (dbType: string, dbName: string, zone: string = "default") => {
	if(!DB[dbType].db[zone]) {
		console.log(zone, "is not present in settings");
	}
    const db = DB[dbType].db[zone][dbName];
    return db;
};

export let ZoneDetector = (req: IRequest, res: Response, next: Function) => {
	next();
}
