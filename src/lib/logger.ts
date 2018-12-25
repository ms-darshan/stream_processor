import { Request, Response } from "express";

let onHeaders = require("on-headers"); // Commonjs style import

import { IRequest, IResponse, LoggerOption, LogWriter } from "../models";
import { Writer } from "./writers/basewriter";
import { DBWriter } from "./writers/dbwriter";
import { FileWriter } from "./writers/filewriter";

function getIp(request: Request): string|undefined {
    return request.ip ||
        (request.connection && request.connection.remoteAddress) ||
        undefined;
}

function recordStartTime() {
    this._startAt = process.hrtime();
    this._startTime = new Date();
}

function calculateResponseTime(res: IResponse, req: IRequest, digits: number): string {
    const responseTime: number = (res._startAt[0] - req._startAt[0]) * 1e3 + (res._startAt[1] - req._startAt[1]) * 1e-6;
    return responseTime.toFixed(digits);
}

const logmod: any = {
    default: defaultFormatter,
    dev: devFormatter,
    production: prodFormatter,
    verbose: verboseFormatter,
};

function defaultFormatter(req: IRequest, res: IResponse, responseTime: number) {
    return `Default: [${req._startTime}] ${getIp(req)} ${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime} ms`;
}

function devFormatter(req: IRequest, res: IResponse, responseTime: number) {
    return `Dev: ${getIp(req)} ${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime} ms`;
}

function prodFormatter(req: IRequest, res: IResponse, responseTime: number) {
    return `Production: ${getIp(req)} ${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime} ms`;
}

function verboseFormatter(req: IRequest, res: IResponse, responseTime: number) {
    return `Verbose: ${getIp(req)} ${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime} ms`;
}

/**
 * Main logging function for logging request and response
 *
 * @param options Object [To customize different functions]
 * @return Function
 */
export function logger(options?: LoggerOption): any {
    options = options || {};
    const writers: LogWriter[]|any = options.writers || [];
    const mode: string = options.mode || "default";
    // Will support for writer defined formatters
    let formatter: Function | any = options.formatter;
    const responseDigits = options.digits || 3;

    if (!formatter) {
        formatter = logmod[mode];
        if (!formatter) {
            console.warn(mode + " not in logmod, please provide a formatter if you want custom");
            formatter = defaultFormatter;
        }
    }

    for (const i in writers) {
        if (!writers[i].write) {
            console.warn("Given writer does not have write method, removing it");
            writers.splice(i, 1);
        }
    }
    writers.push(new Writer());

    return (req: IRequest, res: IResponse, next: () => void) => {
        req._startAt = undefined;
        req._startTime = undefined;

        res._startAt = undefined;
        res._startTime = undefined;

        recordStartTime.call(req);

        function logRequest() {
            res.removeListener("finish", logRequest);
            const line: string = formatter(req, res, calculateResponseTime(res, req, responseDigits));
            for (const i in writers) {
                    const writer: LogWriter = writers[i];
                    if (writer.storageExhausted && writer.storageExhausted()) {
                        if (writer.cleanUp) {
                            writer.cleanUp();
                        } else {
                            console.warn("Writer does not have a cleanUp method");
                        }
                    }
                    writer.write(line + "\n");
            }
        }
        // console.log("Logging the request");
        onHeaders(res, recordStartTime);
        // res.on('header', recordStartTime); // Has been removed
        res.on("finish", logRequest);

        next();
    };
}
