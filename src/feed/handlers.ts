import { Request, Response } from "express";
import { Voldemort } from "../lib/error";
import { route, handler } from "../lib/request";
import { Utils } from "../lib/utils";
import * as validators from "./validators";
import { IRequest } from "../models";
import { Feed } from "./feed_generator";

export const generate_feed = (function() {
	
	this.get = function(req: IRequest, res: Response, next: any) {
		
		const query = req.query;
		let [isValid, validationMsgs] = validators.validateFeed(query);
		
		if(isValid) {
			
			let payload:any  = {};
			let page:number = 0, pagePerLimit:number=30;
			payload["startDate"] = query.startDate;
			payload["endDate"]   = query.endDate;
			
			if(query.hasOwnProperty("user_name")) 
				payload["user_name"] = query.user_name;
			
			if(query.hasOwnProperty("page")) {
				page = parseInt(query.page);
				page = page - 1;
			}
			
			if(query.hasOwnProperty("limit")) {
				pagePerLimit = parseInt(query.limit);
			}

			const instnce = new Feed();
			
			instnce.genrate_feed(payload, (data:any)=>{
				if(data)
					Utils.respond(res, data, "200");
				else
					Utils.respond(res, "Something Went Wrong!", "500");
			}, page, pagePerLimit);

		}else {
			
			Utils.respond(res, "", "400", validationMsgs);
		}
	};

	return route(this);

}).call({})
