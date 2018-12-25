import { Utils } from '../lib/utils';

export function validateFeed(data:any):any {
	const rule: any = {
		user_name: {"type": "string", "required": false},
		startDate: { "type": "string", "required": true },
		endDate: { "type": "string", "required": true }
	};
	return Utils.applyRule(rule, data);
}
