import { ENVIRONMENT, FEEDDBNAME } from "../settings";
import { Client } from "../lib/db";

export class Feed {

	async getFeed(payLoad:any, page:number = 0, pageLimit:number=30):Promise<any> {
		return new Promise((resolve, reject) => {		
			let query: any = {
			};
			
			query.created = {};
			query.created.$gte  = new Date(payLoad["startDate"]);
			query.created.$lte  = new Date(payLoad["endDate"]);
			
			if(payLoad.hasOwnProperty("user_name"))
				query.user_name = payLoad.user_name;

			const mongDb: any   = Client("mongo", FEEDDBNAME[ENVIRONMENT]);
			const cursor:any    = mongDb.collection("feed");
			
			const skips:number =  page*(pageLimit - 1);

			cursor.find(query).skip(skips).limit(pageLimit).toArray(function(err:any, docs:any) {
				if(err) {
					console.log("Exception in fetching feed error ", err, "\n");
					console.log("===============> Query Parameter ", query, " <==============");
					return reject(false);
				}
				return resolve(docs);
			});
		});
	}

	private genrateCreateMessage(usrName:string, itemName:string, isVrnt:boolean=false) {
		if(isVrnt)
			return usrName + " created variant for item " + itemName + ".";
		return usrName + " created item " + itemName + ".";
	}

	private genrateUpdateMessage(usrName:string, atrbtList:any, itemName:string) {
		let msg = usrName + " updated the attributes ";
		
		for (let value of atrbtList) {
			msg = msg + value + ", ";
		}

		msg = msg.substring(0, msg.length - 1);
		msg = msg + " for the item " + itemName + ".";
		return msg;
	}

	private generateDeleteMessage(usrName:string, itemName:string, isVrnt:boolean=true) {
		if (isVrnt)
			return usrName + " deleted variant of item " + itemName + ".";
		return usrName + " deleted item " + itemName + ".";
	}

	private generateListOfItmForAtrbt(usrName:string, itmList:any, atribute:string) {
		let msg = usrName + " updated the attribute " + atribute + " for list of Items ";

		for (let value of itmList) {
			msg = msg + value + ", ";
		}

		msg = msg.substring(0, msg.length - 1);
		msg = msg + ".";
		return msg;
	}

	private genrtPericticularActionMessage(action:string, usrName:string, itemName:string, 
										   atrbtList:any=new Set(), isVrnt:boolean=false) {
		switch(action) {
			case "create": 
				return this.genrateCreateMessage(usrName, itemName, isVrnt);
			case "update":
				return this.genrateUpdateMessage(usrName, atrbtList, itemName);
			case "delete":
				return this.generateDeleteMessage(usrName, itemName, isVrnt);
			case "variant":
				let msg = "";
				
				Object.keys(atrbtList).forEach((vrnt) =>{
					msg = msg + this.genrtPericticularActionMessage(vrnt, usrName, itemName, atrbtList[vrnt], isVrnt=true);
				})

				return msg;
		}
	}

	private generateAtrbtItemFeed(fdObj:any, usr_name:any) {
		let feed_mesgs:any = [];
		
		Object.keys(fdObj).forEach((itm) =>{
			const itmObj = fdObj[itm];
			Object.keys(itmObj).forEach((action) =>{
				const actnObj = itmObj[action];
				const msg     = this.genrtPericticularActionMessage(action, usr_name, itm, actnObj);
				feed_mesgs.push(msg)
			});
		});

		return feed_mesgs;
	}

	private genrateItemspecificFeed(fdObj:any, usr_name:any) {
		let itm_mesgs:any = [];
		
		Object.keys(fdObj).forEach((atrbt) =>{
			const itmSet = fdObj[atrbt];
			if(itmSet.size>2) {
				const msg = this.generateListOfItmForAtrbt(usr_name, itmSet, atrbt);
				itm_mesgs.push(msg);
			}
		});

		return itm_mesgs;
	}

	private generateMessage(feed_data:any):Promise<any> {
		return new Promise((resolve, reject) => {
			let feed_mesgs:any = [];
			
			Object.keys(feed_data).forEach((usrName) =>{
				const usrObject = feed_data[usrName];
				const feedItem  = usrObject["Item"];
				const feedAtrbt = usrObject["Attribute"];
				const itmList   = this.generateAtrbtItemFeed(feedItem, usrName);
				feed_mesgs    = feed_mesgs.concat(itmList);
				const itmSpcMsg = this.genrateItemspecificFeed(feedAtrbt, usrName);
				feed_mesgs = feed_mesgs.concat(itmSpcMsg);
			});

			return resolve(feed_mesgs);
		});
	}

	async mergeFeedWithSameContext(feedList:any):Promise<any> {
		return new Promise((resolve, reject) => {
			let users:any = {};
			let fdLngth = feedList.length;
			
			for(let i =0; i<fdLngth; i++) {
				let fdObj = feedList[i];
				if(!users.hasOwnProperty(fdObj.user_name)) {
					users[fdObj.user_name] = {};
					users[fdObj.user_name]["Item"] = {};
					users[fdObj.user_name]["Attribute"] = {};
				}
				if(!users[fdObj.user_name]["Item"].hasOwnProperty(fdObj.item))
					users[fdObj.user_name]["Item"][fdObj.item] = {};
				if(fdObj.action=="update") {
					if(!users[fdObj.user_name]["Item"][fdObj.item].hasOwnProperty(fdObj.action))
						users[fdObj.user_name]["Item"][fdObj.item][fdObj.action] = new Set();
					for(let i=0; i<fdObj.attribute.length; i++) {
						if(!users[fdObj.user_name]["Attribute"].hasOwnProperty(fdObj.attribute[i]))
							users[fdObj.user_name]["Attribute"][fdObj.attribute[i]] = new Set();
						users[fdObj.user_name]["Item"][fdObj.item][fdObj.action].add(fdObj.attribute[i]);
						users[fdObj.user_name]["Attribute"][fdObj.attribute[i]].add(fdObj.item);
					}
				}
				else {
					if(fdObj.operating == "Variant") {
						users[fdObj.user_name]["Item"][fdObj.item]["variant"] = {};
						users[fdObj.user_name]["Item"][fdObj.item]["variant"][fdObj.action] = 1;
					}else{
						users[fdObj.user_name]["Item"][fdObj.item][fdObj.action] = 1;
					}
				}		
			}

			const msgInstanse: Promise<any> = this.generateMessage(users);
			msgInstanse.then((data:any)=>{
				return resolve(data);
			}).catch((err: any) => {
				console.log("Exception genrating messages ", err);
				resolve(false);
			});
		});
	}

	async genrate_feed(payload:any, cb:Function, page:number = 0, pageLimit:number=30) {
		let feedData:any = await this.getFeed(payload, page, pageLimit);
		if(!feedData || feedData.length<=0) {
			return cb(feedData);
		} 
		let data:any = await this.mergeFeedWithSameContext(feedData);
		return cb(data);
	}
};
