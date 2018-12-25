import kafka = require('kafka-node');

import { Utils } from "./utils";
import { Config } from "../config";
import { KAFKASERVER, ENVIRONMENT } from "../settings";

export class Consumer {
	private db: any;
	private ready: boolean = false;
	private payloads: any[] = [];
	private consumer: any;
	readonly GROUP_ID: string = "itemfeed";

	constructor(protected topics: string | string[] | Array<{ topic: string, partition: number}> | any) {
		this.db = Config.DB.mongo.db['default']['solomon'];

		if(Utils.whatIsIt(this.topics) == 'string') {
			this.topics = [this.topics] as any;
		} else if(Utils.whatIsIt(this.topics) != 'array') {
			throw new Error("Provide a string or array type for topic");
		}
	}

	protected createPayload(offset: any) {
		return {
			topic: offset.topic,
			partition: offset.partition,
			offset: offset.offset + 1
		}
	}

	/**
	 * This will be used when not using ConsumerGroup
	 *
	 * Create payloads for consumer to listen for topics
	 * We can modify it to add partition offset and so on
	 * Check this link: https://www.npmjs.com/package/kafka-node#consumerclient-payloads-options
	 *
	 * @param topics String | Array<string>
	 * @return Array [payloads]
	 */
	protected createPayloads(offsets: any) {
		let payloads: any[] = [];
		for(let offset of offsets) {
			if(offset.value) {
				payloads.push(this.createPayload(offset.value));
			}
		}
		return payloads;
	}

	/*
	 * This will be used when not using ConsumerGroup
	 */
	protected prepareForConsumption() {
		return new Promise((resolve, reject) => {
			let all_topics: Promise<any>[] = [];
			for(let topic of this.topics) {
				// let topic: string | { topic: string, partition: number} = topics[i] as any;
				//console.log("Topic", topic);
				if(Utils.whatIsIt(topic) == 'string') {
					topic = { topic: topic, partition: 0 }; // If topic is string, make it as object
				}
				all_topics.push(this.findOffset(topic.topic, topic.partition));
			}
			Promise.all(all_topics).then((offsets: any[]) => {
				this.payloads = this.createPayloads(offsets);
				console.log(this.payloads);
				if(this.payloads.length < 1) {
					reject("Please provide topics for payload");
					// throw new Error("Please provide topics for payload");
				}
				return resolve(true);
			}).catch((err: Error) => {
				console.log(err);
				reject(err);
			});
		});
	}

	protected fetchOffsetFromServer(topic: string, partition: number) {
		return new Promise((resolve, reject) => {
			let client: any = new kafka.KafkaClient({ kafkaHost: KAFKASERVER[ENVIRONMENT] });
			let offset: any = new kafka.Offset(client);
			// let offset: any = new kafka.Offset(Config.KAFKA_CLIENT.instance);
			offset.fetch([
				{ topic: topic, partition: partition, time: -2, maxNum: 1 }
			], function (err: any, data: any) {
				if(err) {
					console.log("Error fetching offsert from server", err);
					return reject(err);
				}
				console.log("Data got from server", data);
				resolve(data); // { 't': { '0': [999] } }
			});
		});
	}

	protected findOffset(topic: string, partition: number = 0): Promise<any> {
		return this.db.collection('pubsub').findAndModify(
            { topic: topic, partition: partition }, // query
            [], // sort
            {
                $setOnInsert: { 
                    timestamp: new Date().getTime(),
                    topic: topic,
					offset: -1,
					highWaterOffset: 0
                }
            }, // update
            { upsert: true, new: true } // options
        );
	}

	protected updateOffset(topic: string, partition: number, offset: number, highWaterOffset: number, key?: string) {
		let $setObj: any = { 
			timestamp: new Date().getTime(),
			offset: offset,
			highWaterOffset: highWaterOffset,
		};
		if(key) {
			$setObj['key'] = key;
		}
		return this.db.collection('pubsub').updateOne(
			{ topic: topic, partition: partition }, 
			{ $set: $setObj }
		);
	}

	protected process(message: string, success_callback: Function, error_callback: Function) {
		try {
			if(!message) {
				return;
			}

			let msg: any = JSON.parse(message);

			if(!msg["data"]) {
				console.log("No solomon data has been found on the received data from publisher", message);
				// Insert into errors
				return;
			}
			console.log("Kafka Consumer Latency =", Date.now() - (parseInt(msg['time']) || 0), "ms");
			success_callback(msg["data"], msg['type'], msg['time']);
		} catch(err) {
			console.log("Error processing consumed message", err);
			Utils.insertError("default", err, "kafka_consumer", { "topics": this.topics, "message": message }, "consumer", "processing_message")
			error_callback(err);
		}
	}

	get consumerOptions() {
		return {
			groupId: "solomon",
			autoCommit: true,
			fromOffset: true,
			protocol: ['roundrobin'],
		};
	}

	get consumerGroupOptions(): kafka.ConsumerGroupOptions {
		return {
			kafkaHost: KAFKASERVER[ENVIRONMENT],
			groupId: this.GROUP_ID,
			autoCommit: true,
			autoCommitIntervalMs: 5000,
			sessionTimeout: 15000,
			fetchMaxBytes: 10 * 1024 * 1024, // 10 MB
			// An array of partition assignment protocols ordered by preference. 'roundrobin' or 'range' string for
			// built ins (see below to pass in custom assignment protocol)
			protocol: ['roundrobin'],
			fromOffset: 'latest',
			outOfRangeOffset: 'earliest'
		};
	}

	async consume(success_callback: Function, error_callback: Function) {
		this.consumer = new kafka.ConsumerGroup(this.consumerGroupOptions, this.topics);
		let fetchingOffset: any = {};

		this.consumer.on('message', (message:any) => {
			this.process(message.value, success_callback, error_callback);
		});

		this.consumer.on('error', (err:any) => {
			Utils.insertError("default", err, "kafka_consumer", this.topics, "consumer", "consuming_topic")
			error_callback(err);
		});
	}

	close() {
		this.consumer.close(() => {
			console.log('SuccessFully closed the connection for ', this.topics);
		});
	}

}
