import { Request, Response } from 'express';
import { Db } from 'mongodb';

export interface DatabaseObject {
    urlGenerator: Function,
    db: any,
    connect: Function,
	initSchema?: Function,
	ensureIndexes?: Function,
	pgp?: any
}

export interface RoutesType {
    path: string;
    method: string;
    action: (req: Request, res: Response, callback: Function) => void;
}

export interface ApiResponse {
    status: string;
    code: number;
    data: any;
}

export interface SocketType {
    path: string;
    instance: Function;
}
export interface UtilsType {
	[x: string]: Function
}

export interface ResourceHandler {
    all?(request: Request, response: Response): void;
    get?(request: Request, response: Response): void;
    index?(request: Request, response: Response): void;
    post?(request: Request, response: Response): void;
    put?(request: Request, response: Response): void;
    delete?(request: Request, response: Response): void;
    destroy?(request: Request, response: Response): void;
}

export interface LogWriter {
    write(data: string): void;
    storageExhausted(): boolean;
    cleanUp(): void;
}

export interface LoggerOption {
    writers?: LogWriter[];
    formatter?: any; // (req: Request, res: Response, responseTime: string) => string
    mode?: string;
    digits?: number;
}

export interface AuthUser {
        refid: string;
        name: string;
}

export interface RequestAuth {
        access_token?: string;
        organization: string;
        connection: string;
        database: string;
        user: AuthUser;
        client_id?: string;
}

export interface IRequest extends Request {
    _startTime: any;
    _startAt: any;
	zone: string;
	auth: RequestAuth;
	company?: string;
	userid?: string;
}

export interface IResponse extends Response {
    _startTime: any;
    _startAt: any;
}

export interface KafkaProducerObject {
    prdcrInstance : any,
	connect   : Function
}

export interface Eway_Authentication {
	username: string;
	password: string;
	client_id: string;
	client_secret: string;
	grant_type: string;
}

/**
 * To make a class accessible as index
 * 
 * ex: class Test extends Indexable {
 *      public run() {
 *      }
 * }
 * let obj = new Test();
 * let method = obj['run'] ? obj['run'] : () => void;
 * 
 * Note: If you make it interface, it won't work.
 * Link: https://github.com/Microsoft/TypeScript/issues/5685
 */
export class Indexable {
    [key: string] : any;
}
