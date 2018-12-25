import { LogWriter } from "../../models";
import { Writer } from "./basewriter";

export class DBWriter implements LogWriter {

    public storageExhausted() {
        return true;
    }

    public cleanUp() {
        // Database clean up goes here
    }

    public write(data: string) {
        console.log("Logging data to database : ", data);
    }
}
