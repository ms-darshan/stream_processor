import kafka = require('kafka-node');

import { Utils } from "./utils";
import { Config } from "../config";

export class Producer {
	private producer: kafka.HighLevelProducer;

	constructor(private organization?: string) {
		this.producer = Config.kafkaproducer.prdcrInstance['producer'];
	}

	protected formatData(message: any) {
		try {
			let fmt_data: any = {
				"data" : message,
				"type" : Utils.whatIsIt(message),
				"time" : Date.now()
			};
			return JSON.stringify(fmt_data);
		} catch(err) {
			console.log("Exception in formating data " + " Error " + err + " For channel ", message);
			return false;
		}
	}

	protected createPayloads(topic: string, message: any) {
		let data: string | false = this.formatData(message);
		if(!data) return false;
		return [
			{ topic: topic, messages: data },
		];
	}

	produce(topic: string, message: any, callback?: Function) {
		let payloads: kafka.ProduceRequest[] | false = this.createPayloads(topic, message);
		if(!payloads) {
			console.log("No payloads created");
			if(callback) 
				return callback("No payloads created");
		}
		this.producer.send(payloads as kafka.ProduceRequest[], (err: any, data: any) => {
			if(err){
				console.log("Error in sending data in channel " + topic + " err = " + err);
				Utils.insertError("default", err, "kafka_producer", { topic: topic, message: message, payloads: payloads }, "producer", "producing_message");
			}
			console.log("Data Sent Success fully for channel " + topic);
			if(callback) 
				callback(err, data);
		});
	}

	produceBatch(topic: string, messages: any[]) {
	}
}
