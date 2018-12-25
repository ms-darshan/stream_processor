import * as express from "express";
import { Config } from "./config";

class App {
    public express: express.Express;

    constructor() {
        this.express = express()
    }
}

export default new App().express
