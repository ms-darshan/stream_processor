import { Consumer } from "../lib/consumer";
import { Client } from "../lib/db";
import { ENVIRONMENT, FEEDDBNAME } from "../settings";

export class ItemConsume {
	public start_process(data:any) {
		this.feedGenrtn(data);
	}
	
	private execute(batch: any, batchNumber: number, callback?: Function) {
        if(batch.length > 0 ){
             batch.execute().then((res:any ) => {
                console.log(batchNumber, "Batch executed successfully", batch.length);
                if(callback) callback(true);
             }).catch((err: any) =>{
                console.log("Exception executing batchNumber: ", batchNumber);
                 if(callback) callback(false);
             });
        } else {
            console.log(batchNumber, "No batch operations to run");
            if(callback) callback(true);
        }
	}

	async fetchAnyPreviousUserAction(data:any) {
		try {
			const mongDb: any = Client("mongo", FEEDDBNAME[ENVIRONMENT]);
			let query: any = {
				"user_name": data.user_name
			};

			if(data.hasOwnProperty("action")) {
				query.action = data.action;
			}
			
			const cursor:any    = mongDb.collection("feed");
			
			cursor.find(query).toArray(function(err:any, docs:any) {
				if(err) {
                    console.log("Exception in fetching user action for user ", data.user_name, " error ", err, "\n");
                    console.log("===============> Query Parameter ", query, " <==============");
                    return false;
                }
				return docs;
			});
		}catch(err) {
			console.log("Exception in feting user Action for user", data.user_name);
			return false;
		}
	}

	async userItemFeedHandler(data:any) {
		const fields:any = {
			"user_name" : data.user_name,
			"item"      : data.item_name,
			"feedGenrtTime": data.whtTime,
			"action" : data.action,
			"operating": "Item",
			"created": new Date(),
			"updated": new Date()
		};
		if(data.hasOwnProperty("attribute"))
			fields["attribute"] = data.attribute;
		
		const mongDb: any = Client("mongo", FEEDDBNAME[ENVIRONMENT]);
		const cursor:any    = mongDb.collection("feed");
		cursor.insert(fields);
	}

	async feedGenrtn (data:any) {
		let itmObject:any = data.item;
		this.userItemFeedHandler(itmObject);
	}
}

let itm_instanse = new ItemConsume();
let itm_topic    = "item_feed";

export let ItemconsumInstance:any = {
	consumeCallback : async (dta:any, dataType:string, prdc_time:any) =>{
		itm_instanse.start_process(dta);
	},

	errInConsumer : async (err:any) =>{
		console.log("Error in consuming kafka topic");
	},

	strtConsume() {
		new Consumer([itm_topic]).consume(ItemconsumInstance.consumeCallback, ItemconsumInstance.errInConsumer);
	}
};
