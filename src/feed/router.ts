import * as express from "express";
import { Request, Response } from "express";
import * as middleware from "../lib/middleware";
import { Utils } from "../lib/utils";
import { wrap_class } from "../lib/request";
import * as handler from "./handlers";

let router = express.Router();
router.use(middleware.authenticate);

router.get("/listfeed", handler.generate_feed)

export let Router = router;
