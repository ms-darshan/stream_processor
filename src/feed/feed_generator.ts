import { ENVIRONMENT, FEEDDBNAME } from "../settings";
import { Client } from "../lib/db";

export class Feed {

	async getFeed(payLoad:any, page:number = 0, pageLimit:number=30):Promise<any> {
		return new Promise((resolve, reject) => {		
			let query: any = {
				
			};
			query.created = {};
			query.created.$gte  = new Date(payLoad["startDate"]);
			//query.created.$lte  = new Date(payLoad["endDate"]);
			
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
		for(let i=0; i<atrbtList.length; i++) {
			msg = msg + atrbtList[i] + ", "
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
		for(let i=0; i<itmList.length; i++) {
				msg = msg + itmList[i] + ", ";
		}
		msg = msg.substring(0, msg.length - 1);
		msg = msg + ".";
		return msg;
	}

	private genrtPericticularActionMessage(action:string, usrName:string, itemName:string, 
										   atrbtList:any=[], isVrnt:boolean=false) {
		switch(action) {
			case "create": 
				return this.genrateCreateMessage(usrName, itemName, isVrnt);
			case "update":
				return this.genrateUpdateMessage(usrName, atrbtList, itemName);
			case "delete":
				return this.generateDeleteMessage(usrName, itemName, isVrnt);
			case "variant":
				let msg = "";
				for(let vrnObj in atrbtList) {
					if(atrbtList.hasOwnProperty(vrnObj)) {
						msg = msg + this.genrtPericticularActionMessage(vrnObj, usrName, itemName, 
															atrbtList[vrnObj], isVrnt=true);
					}
				}
				return msg;
		}
	}

	private generateAtrbtItemFeed(fdObj:any, usr_name:any) {
		let feed_mesgs = [];
		for(let itm in fdObj) {
			if(fdObj.hasOwnProperty(itm)) {
				let fedItmObj = fdObj[itm];
				for(let fdAtrbt in fedItmObj) {
					if(fedItmObj.hasOwnProperty(fdAtrbt)) {
						let actnObj = fedItmObj[fdAtrbt];
						let msg = this.genrtPericticularActionMessage(fdAtrbt, usr_name, itm, actnObj);
						feed_mesgs.push(msg)
					}
				}
			}
		}
		return feed_mesgs;
	}

	private genrateItemspecificFeed(fdObj:any, usr_name:any) {
		let itm_mesgs = [];
		for(let atrbt in fdObj) {
			if(fdObj.hasOwnProperty(atrbt)) {
				let itmObj = fdObj[atrbt];
				if(itmObj.length>2) {
					let msg = this.generateListOfItmForAtrbt(usr_name, itmObj, atrbt);
					itm_mesgs.push(msg);
				}
			}
		}
		return itm_mesgs;
	}

	private generateMessage(feed_data:any):Promise<any> {
		return new Promise((resolve, reject) => {
			let feed_mesgs:any = [];
			for (let usr in feed_data) {
    			if (feed_data.hasOwnProperty(usr)) {           
					let feedItem  = feed_data[usr]["Item"];
					let feedAtrbt = feed_data[usr]["Attribute"];
					let itmList   = this.generateAtrbtItemFeed(feedItem, usr);
					feed_mesgs    = feed_mesgs.concat(itmList);
					let itmSpcMsg = this.genrateItemspecificFeed(feedAtrbt, usr);
					feed_mesgs = feed_mesgs.concat(itmSpcMsg);
    			}
			}
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
						users[fdObj.user_name]["Item"][fdObj.item][fdObj.action] = [];
					for(let i=0; i<fdObj.attribute.length; i++) {
						if(!users[fdObj.user_name]["Attribute"].hasOwnProperty(fdObj.attribute[i]))
							users[fdObj.user_name]["Attribute"][fdObj.attribute[i]] = [];
						if(users[fdObj.user_name]["Item"][fdObj.item][fdObj.action].indexOf(fdObj.attribute[i]) == -1)
							users[fdObj.user_name]["Item"][fdObj.item][fdObj.action].push(fdObj.attribute[i]);
						if(users[fdObj.user_name]["Attribute"][fdObj.attribute[i]].indexOf(fdObj.item) == -1)
							users[fdObj.user_name]["Attribute"][fdObj.attribute[i]].push(fdObj.item);
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
