import kafka = require('kafka-node');
import { Client } from "../lib/db";
/*
require('console-stamp')(console, { pattern : "mm/dd/yyyy HH:MM:ss.l",
			            colors: {
			              stamp: 'yellow',
				      label: 'white',
				      metadata: 'green'
			             }
				  });
 */
import { ZOOKEEPERSERVER, ENVIRONMENT, FEEDDBNAME } from "../settings";
import { Config } from '../config';
import { Utils } from './utils';
import { kafkaProducer } from './producer_old';

let kafka_host = ZOOKEEPERSERVER[ENVIRONMENT];
let Consumer   = kafka.Consumer;


function do_process(msg_str_obj:any, consum_str_time: number, callback:Function, errCallback:Function, topic:string) {
    try {
		if (!msg_str_obj) {
			console.log("D_=====> ", msg_str_obj)
			return;
		}
		msg_str_obj   = JSON.parse(msg_str_obj);
        let prdc_time:any = msg_str_obj['time'];
        let dataType:string   = msg_str_obj['type'];
        let data:any      = msg_str_obj['data'];
		console.log(data);
		console.log(typeof(data));
        if((!data.item) && (!data.variant)) {
            console.log("No Item or Variant data has been found on the received data from publisher");
            // Insert into errors
            return;
        }
        console.log("DATA Item or variant", data);
        callback(data, dataType, prdc_time);
        // callback(msg_str_obj);

        let cnsmd_at = Date.now();
        let diff = cnsmd_at - prdc_time;

        if(consum_str_time>prdc_time) {            
            console.log("LateConsumer : Consumer Starts after Producer Produce Msg. Latency = " + diff + " ms" + " For Channel " + topic);
            return;
        }else {
            console.log("Kafka Consumer Latency = " + diff + " ms For Channel " + topic);
            return;
        }
    } catch(err) {
		console.log("exception In processing the recieved message " + err + " For Channel " + topic, 
				   + " Data => ", msg_str_obj);
		errCallback(err);
        return;
    }
}

function findOffset(topic: string) {
    let mongo = Client("mongo", FEEDDBNAME[ENVIRONMENT]);
    // return mongo.collection('pubsub').find({ topic: topic }).toArray();
    return mongo.collection('pubsub').findAndModify(
            { topic: topic }, // query
            [], // sort
            {
                $setOnInsert: { 
                    timestamp: new Date().getTime(),
                    topic: topic,
                    offset: -1
                }
            }, // update
            { upsert: true, new: true } // options
        );
}

function fetchOffsetFromServer(topic: string, client: any) {
    return new Promise((resolve, reject) => {
        let offset: any = new kafka.Offset(client);
        offset.fetch([
            { topic: topic, partition: 0, time: -2, maxNum: 1 }
        ], function (err: any, data: any) {
            if(err) {
                console.log("Error fetching offsert from server", err);
                return reject(err);
            }
            console.log("Data got", data);
            resolve(data); // { 't': { '0': [999] } }
        });
    });
}

function updateOffset(topic: string, offset: number, partition: any, highWaterOffset: number, key?: any) {
    let mongo = Client("mongo", FEEDDBNAME[ENVIRONMENT]);
    return mongo.collection('pubsub').update(
        { topic: topic }, 
        { $set: { 
            timestamp: new Date().getTime(),
            topic: topic,
            offset: offset,
            partition: partition,
            highWaterOffset: highWaterOffset,
            key: key
        }
    });
}

/**
 * Create payloads for consumer to listen for topics
 * We can modify it to add partition offset and so on
 * Check this link: https://www.npmjs.com/package/kafka-node#consumerclient-payloads-options
 *
 * @param topics String | Array<string>
 * @return Array [payloads]
 */
async function createPayloads(topics: string | Array<string> | any) {
    return new Promise(async (resolve, reject) => {
        if(Utils.whatIsIt(topics) == 'string') {
            topics = [topics];
        } else if(Utils.whatIsIt(topics) != 'array') {
            reject("Provide a string or array type for topic");
        }

        kafkaProducer.createTopics(topics);// If topics are not in consumer, it gives error and stops listening

        let payloads: Array<any> = [];
        for(let i in topics) {
            let topic: string = topics[i];
            let offset = -1;
            try {
                let offset_result: any = await findOffset(topic);
                if(offset_result) {
                    offset = offset_result.value.offset;
                }
                console.log("offset for ", topic, offset);
                payloads.push({
                    topic: topic, offset: offset + 1
                });
            } catch(err) {
                reject(err);
            }
        }
        if(payloads.length < 1) {
            reject("No payloads");
        }
        console.log('payloads', payloads);
        return resolve(payloads);
    });
}

// We can make this options dynamic also
function consumerOptions() {
    return {
        autoCommit: true,
        fromOffset: true
    };
}

async function start_consume(var_topic:string | Array<string>, callback:Function, errCallback:Function) {
    try {
        let client   = new kafka.Client(kafka_host);
        let payloads: any = []
        try {
            payloads = await createPayloads(var_topic);
        } catch(err) {
            throw err;
        }

        let consumer = new Consumer(
            client, 
            payloads, 
            consumerOptions()
        );
        let consumer_strt_time  = Date.now();
		// let fetchingOffset: boolean = false;
		let fetchingOffset: any = {};

        consumer.on('message', (message:any) => {
            console.log("Got Data for channel "+ var_topic + ", Data: " + message.value);   
            updateOffset(message.topic, message.offset, message.partition, message.highWaterOffset, message.key);
            do_process(message.value, consumer_strt_time, callback, errCallback, message.topic);
        });

        consumer.on('error', (err:any) => {
            console.log('Error in consuming kafka message for channel ', var_topic, ' ERROR is ' + err);
            errCallback(err);
        });

        consumer.on('offsetOutOfRange', async (err: any) => {
            console.log("Offset out of range for channel "  + var_topic + " ERROR is " + err);
            if(fetchingOffset[err.topic]) {
                return;
            }
            for(let i in payloads) {
                if(payloads[i].topic == err.topic) {
                    console.log("Setting up offset");
					// fetchingOffset = true; // Need to use per topic (as a dict)
					fetchingOffset[err.topic] = true;
                    let result: any = await fetchOffsetFromServer(payloads[i].topic, client);
                    let offset: any = result[payloads[i].topic]['0'][0];

                    let data: any = {
                        topic: err.topic,
                        localOffset: payloads[i].offset,
                        serverOffset: offset
                    };
                    Utils.insertError(err, "kafka_user", data, "kafka_consumer", "offsetOutOfRange", "");
                    consumer.setOffset(err.topic, err.partition, offset);
                    updateOffset(err.topic, offset - 1, err.partition, offset);
                    // consumer.setOffset(err.topic, err.partition, payloads[i].offset);
					// break;
                }
            }
			errCallback(err);
        });

        function close_connection() {
            consumer.close(function(){console.log('SuccessFully closed the connection For channel ', var_topic)});
        }

        let conctn_function:any = {
            close_connection : close_connection
        };
        return conctn_function;
    } catch(err){
        console.log('Exception in registering consumer ', var_topic, err);
        errCallback(err);
        return;
    }
}

function make_topic_partition(producerSrvc:string, consmrSrvc:string) {
    let chnl = producerSrvc + '-' + consmrSrvc;
    return chnl;
}

function consume_kafka_topic(var_topic:string, callback:Function, errCallback:Function) {
    return start_consume(var_topic, callback, errCallback);
}

export let kafkaConsumer: any = {
	make_topic_partition : make_topic_partition,
	consume_kafka_topic : consume_kafka_topic
};

