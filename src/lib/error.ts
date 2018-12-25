import { Request, Response } from "express";

import { Utils } from "../lib/utils";
import { IRequest, IResponse, LogWriter } from "../models";

/**
 * Return the required error to log
 *
 * @param err Error
 * @param req Request
 * @param res Response
 * @return String
 */
function errorFormatter(err: Error, req: IRequest, res: IResponse) {
    return `Error: [${req._startTime}]
     ${req.method} ${req.originalUrl} ${res.statusCode} ${err.message} \n${err.stack}`;
}

/**
 *  Custom Error class for flexible use
 */
export class Voldemort extends Error {
    private code: number;

    constructor(message: string, code: number) {
        super(message);
        this.code = code;
   }

    public getCode() {
        return String(this.code);
    }
}

/**
 * Middleware to handle any error
 *
 * @param writer Writer [To write error log]
 * @return Function [ use for middleware]
 */
export function errorHandler(writer?: LogWriter|any): any {
    writer = writer || process.stdout;

    if ( !writer.write ) {
        console.warn("Error writer does not have a write method.");
        writer = process.stdout;
    }

    return function logError(err: Error, req: IRequest, res: IResponse, next: (arg?: any) => void): any {
        if (res.headersSent) {
            return next(err);
        }
        if (err instanceof Voldemort) {
            Utils.respond(res, err.message, err.getCode(), err.message);
        } else {
            Utils.respond(res, err.message, "500", err.message);
        }

        // Write to error log
        if (typeof err.message !== "string") {
            err.message = JSON.stringify(err.message);
        }

        if (writer.storageExhausted && writer.storageExhausted()){
            if (writer.cleanUp) {
                writer.cleanUp();
            } else {
                console.warn("Error: Writer does not have a cleanUp method");
            }
        }

        writer.write(errorFormatter(err, req, res) + "\n");
    };
}

export function unhandledPromiseHandler(callback?: Function): any {    
        (process as NodeJS.EventEmitter).on('unhandledRejection', function(err: Error) {
                console.warn("Unhandled promise rejection", err);      
                if(callback) callback(err);
				//throw err;
				//process.exit(1);                                    
        });     
}       
