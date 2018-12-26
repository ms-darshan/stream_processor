import * as http from "http";

import { Config } from "./config";
//import { ApiResponse, LogWriter, RoutesType } from "./models";
import { Router } from "./router";
import { APP_CONFIG, ALLOW_CORS, ENVIRONMENT } from "./settings";
import { errorHandler } from "./lib/error";
import { init } from "./boot";
import { ZoneDetector } from './lib/db';
import { ItemConsume } from './stream_worker/item_consumer';
import { VariantConsume } from './stream_worker/variant_consumer';

const port  = APP_CONFIG.PORT || 5050;

// Set process name=====================================================
process.title = "ItemFeed-Server";
//======================================================================

// Set node ENVIRONMENT =====================================================
process.env['NODE_ENV'] = ENVIRONMENT;
///==========================================================================

function mountRoutes(app: any): void {
    for (const thisApp in Router) {
		app.use(Config.URL_PREFIX + thisApp, Router[thisApp]);
	}
	app.use(errorHandler());
}

init((err: any, app: any) => {
	if(err) {
		console.log(err);
		process.exit();
		return;
	}
	//app.use(ZoneDetector);
	mountRoutes(app);
	app.use(errorHandler());
	ItemConsume.getInstance().strtConsume()
	VariantConsume.getInstance().strtConsume();
	const server= http.createServer(app);
	server.listen(port, (err: any) => {
		if (err) {
			return console.log(err)
		}
		return console.log(`server is listening on ${port}`)
	});
});
