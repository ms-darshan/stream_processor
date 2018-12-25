import { Config } from '../config';
import { Utils } from '../lib/utils';


function make_topic_partition(producerSrvc: string, consmrSrvc: string): string{
 	let chnl = producerSrvc + '-' + consmrSrvc;
  	return chnl;
}

let stringConstructor = "test".constructor;
let arrayConstructor = [].constructor;
let objectConstructor = {}.constructor;

function whatIsIt(object: any, var_topic: string) {
    try {
        if (object === null) {
            console.log("No data to produce please send some data for channel " + var_topic);
            return false;
        } else if (object === undefined) {
            console.log("Data is undefined please check before sending to kafkaproducer for channel " + var_topic);
            return false;
        } else if (object.constructor === stringConstructor) {
            return "string";
        } else if (object.constructor === arrayConstructor) {
            return "array";
        } else if (object.constructor === objectConstructor) {
            return "object";
        } else if (!isNaN(object)) {
            return "number";
        } else {
            console.log("Object don't no for channel " + var_topic);
            return false;
        }
    } catch(err) {
		console.log("Exception in figuring the dataType of the message " + " Error " + err + " For topic " + var_topic);
		return false;
	}
}

function format_data(var_data: any, var_topic: string) {
	try {
		let d_type = whatIsIt(var_data, var_topic);
		if(!d_type) {
			return false;
		}
		let produce_time = Date.now();
		let fmt_data:any = {
			"data" : var_data,
			"type" : d_type,
			"time" : produce_time
		};
		fmt_data = JSON.stringify(fmt_data);
		return fmt_data;
	} catch(err) {
		console.log("Exception in formating data " + " Error " + err + " For channel " + var_topic);
		return false;
	}
}

function produceMessage(var_topic: string, var_message: any) {
	try {
		let producer  = Config.kafkaproducer.prdcrInstance['producer'];
		let fmtd_data = format_data(var_message, var_topic);
		if(!fmtd_data) {
			console.log('No data or Object type not found for topic ' + var_topic);
			return false
		}
		let payloads = [
			{ topic: var_topic, messages: fmtd_data },
		];
		producer.send(payloads, (err: any, data: any) => {
			if(err){
				console.log("Error in sending data in channel " + var_topic + " err = " + err);
				Utils.insertError(err, 'kafka_user', payloads, 'producer', 'producing_message', '');
				return false;
			}
			console.log("Data Sent Success fully for channel " + var_topic);
			return true;
		});
	} 	catch(err) {
		console.log("Exception in sending data in channel " + var_topic + " err = ", err);
		return false;
	}
}

function createTopics(topics: Array<string>, a_sync=false) {
    let producer  = Config.kafkaproducer.prdcrInstance['producer'];
    try {
        producer.createTopics(topics, a_sync, function (err: any, data: any) {
            if(err) {
                console.log("Error creating topics", err);
            }
            console.log("Topics created successfully ", topics);
        });
    } catch(err){
        console.log("Error creating topics", err);
    }
}

export let kafkaProducer: any = {
	make_topic_partition : make_topic_partition,
    produceMessage : produceMessage,
    createTopics: createTopics
};

