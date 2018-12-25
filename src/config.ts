import { MongoClient, MongoError } from "mongodb";
import * as kafka from "kafka-node";
import * as pg from "pg";
import * as redis from 'redis';
import { DatabaseObject, KafkaProducerObject } from "./models";
import Schema from "./schema";
import * as settings from "./settings";

const MONGO: DatabaseObject = {
    urlGenerator(creds: any) {
        const self = this;
        let authStr = creds.user + ":" + creds.pwd + "@";
        if (!creds.user || !creds.pwd) {
            authStr = "";
        }
        let hostStr: any = [];
        if (creds.host.constructor !== [].constructor) {
            return false;
        }
        for (let i = 0; i < creds.host.length; i++) {
            hostStr.push(creds.host[i] + ":" + creds.port[i]);
        }
        hostStr = hostStr.join(",");
        const dbName = creds.db;
        let replicaSet = "";
        if (creds.replicaSet) {
            replicaSet = "?replicaSet=" + creds.replicaSet;
        }
        const murl = "mongodb://" + authStr + hostStr + "/" + dbName + replicaSet;
		console.log(murl);
        return murl;
    },
    db: {},
    connect(zone: string, creds: any, callback: Function) {
        const self = this;
        const dbName: string = creds.db;
        const url: string = self.urlGenerator(creds);
        if (!url) {
            console.log(dbName, "URL generation failed.");
            callback(false);
            return false;
        }
        MongoClient.connect(url, (err: MongoError, client: any) => {
            if (err) {
                console.log("MONGO CONNECT ERROR", err);
                callback(false);
                throw Error("Mongo connection error, abort abort abort...");
            }
			if(!self.db[zone]) {
				self.db[zone] = {};
			}
            self.db[zone][dbName] = client.db(dbName);
            if (self.initSchema) {
                self.initSchema(self.db[zone][dbName], dbName).then(() => {
                    console.log("SCHEMA INIT SUCCESS: ", dbName, zone);
					self.ensureIndexes(self.db[zone][dbName], dbName).then(() => {
						console.log("Indexing Done for", dbName, zone);
						callback(true);
					}).catch((err: any) => {
						console.log("Indexing Err: ", err, zone);
						callback(false);
					});
                }).catch((errs: any) => {
                    for (const i in errs) {
                        console.log("SCHEMA INIT ERR: ", errs[i].message);
                    }
                    console.log(errs);
                    callback(false);
                });
            } else {
                callback(true);
            }
        });
    },
    initSchema(db: any, dbName: string) {

        return new Promise((resolve, reject) => {
            db.listCollections().toArray( (err: any, collInfos: any) => {
                if (err) {
                    console.log("ERR: ", err.message);
                    reject(err);
                    return;
                }
                const s = new Schema.mongoSchema();
				let qList = s.getQueryList(dbName);
                // console.log("QLIST: ", qList);
                if (!qList) {
                    console.log("No schema list found for: ", dbName);
                    resolve();
                    return;
                }
                let colls = [];
                for (const i in collInfos) {
					colls.push(collInfos[i].name);
                }
                // console.log("Colls: ", colls);
                let count = 0;
                let collLen = qList.length;
                let errors: any = [];

                const respond = () => {
                    count += 1;
                    if (count === collLen) {
                        if (errors.length) {
                            reject(errors);
                        } else {
                            resolve();
                        }
                    }
                };

                for (let i in qList) {
					let sname = qList[i];
					let strct = s.getQuery(dbName, sname);
					// console.log("STRCT: ", strct);
					if (!strct) {
						respond();
						continue;
					}
					if (colls.indexOf(sname) > -1) {
						attachValidator(db, sname, strct).then((res: any) => {
							respond();
						}).catch((err1: any) => {
							errors.push(err1);
							respond();
						});
					} else {
						createCollection(db, sname, strct).then((res: any) => {
							respond();
						}).catch((err2: any) => {
							errors.push(err2);
							respond();
						});
					}
                }
            });
        });
	},
	ensureIndexes(db: any, dbName: string) {
		return new Promise((resolve, reject) => {
			const s = new Schema.mongoSchema();
			let list: any = s.getIndexList(dbName);
			for(let i in list) {
				let collection: string = list[i];
				let indexes: any = s.getIndex(dbName, collection);
				if(indexes) {
					for(let j in indexes) {
						let index: any = indexes[j];
						try {
							let res: any = db.collection(collection).ensureIndex(index);
						} catch(e) {
							console.log("Err in ensuring index", e);
						}
					}
				}
			}
			resolve(true);
		});
	},
};

let REDIS: DatabaseObject = {
	urlGenerator: function (creds:any) {
		let self: any = this;
		let authStr: string = "";
		if(creds['pwd']){
			authStr = `:${creds['pwd']}@`;
		}
		return "redis://" + authStr + creds["host"] + ":" + creds["port"] + "/" + creds.db
	},
	db: {},
	connect: function(creds:any, callback: Function) {
		let self = this;
		let dbName: string = creds["db"];
		let dbAlias: string = creds["dbAlias"]; // Because dbName is number here 
		let url: string = self.urlGenerator(creds);
		if (!url) {
			callback(false);
			return false;
		}
		let client = redis.createClient(url, creds.options || {});
		client.on("error", function (err: any) {
			console.log("Redis Error " + err);
		});
		self.db[dbName] = client;
		callback(true);
	},
	ensureIndexes: function() {
		console.log("Not required here");
	}
}

function attachValidator(db: any, coll: string, querySet: any) {
    return new Promise((resolve, reject) => {
        const s = new Schema.mongoSchema();
        db.command({
            collMod: coll,
            validationLevel: "strict",
            validator: querySet,
        }, (err: any, res: any) => {
            if (err) {
                console.log("Attach Validation err: ", coll, err.message);
                reject(err);
                return;
            }
            console.log("Attach validation: ", coll);
            resolve(res);
        });
    });
}

function createCollection(db: any, coll: string, querySet: any) {
    return new Promise((resolve, reject) => {
        const options = {
            validationLevel: "strict",
            validator: querySet,
        };
        db.createCollection(coll, options, (err: any, res: any) => {
            if (err) {
                console.log("Create Collection with Validation err: ", coll, err.message);
                reject(err);
                return;
            }
            console.log("Create Collection with Validation: ", coll);
            resolve(res);
        });
    });
}

const KAFKAPRODUCER: KafkaProducerObject = {
    prdcrInstance : {},
    connect : function(kafka_server:any, callback:Function){
        let self = this;
        if(!kafka_server){
            callback(false);
            return false;
        }
        try{
            var Producer = kafka.Producer;
            const client = new kafka.KafkaClient({kafkaHost: kafka_server});
            var producer = new Producer(client);
            producer.on('ready', function() {
                console.log('Kafka Producer is ready ');
                self.prdcrInstance['producer'] = producer;
                callback(true);
                return;
            });
            producer.on('error', function (err: any) {
                console.log("Problem with producing Kafka message "+err);
                callback(false);
                return false;
            });
        } catch(error){
            console.log("Exception in connecting to KafkaServer "+ kafka_server + " Error " + error);
            callback(false);
            return false;
        }
    }
}

export let Config: any = {
    DB  : {
        mongo: MONGO
    },
	CACHE: REDIS,
	CACHE_DB: settings.CACHE_DB || "6",
	GLOBAL_CACHE_DB: settings.GLOBAL_CACHE_DB || "0",
	kafkaproducer: KAFKAPRODUCER,
	port: 3001,
	URL_PREFIX: "/api/" + settings.API_VERSION + "/",
	PAGE_LIMIT: 50
}
