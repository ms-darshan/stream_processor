import * as fs from "fs";

import { LogWriter } from "../../models";
import { Writer } from "./basewriter";

export class FileWriter extends Writer implements LogWriter {
    private file: string;
    private MAX_FILE_SIZE: number; // in MB

    constructor(filePath: string, maxFileSize: number = 3) {
        super();
        this.MAX_FILE_SIZE = maxFileSize;
        this.file = filePath;
        this.cleanUp();
        console.log(this.MAX_FILE_SIZE);
    }

    /**
     * Check if the file size is greater than max size
     *
     * @return boolean
     */
    public storageExhausted(): boolean {
        // console.log("Checking for max file");
        if (this.fileExists()) {
            if (this.fileSizeInMBs() >= this.MAX_FILE_SIZE) {
                return true;
            }
        }
        return false;
    }

    /**
     * Function to perform if storageExhausted() returns true
     */
    public cleanUp() {
        // console.log("Creating new file");
        let counter: number = 1;
        while (this.storageExhausted()) {
            const splittedArr: string[] = this.file.split(".");
            const last: string | undefined = splittedArr.pop();
            if (last === "log") {
                splittedArr.push("log");
            }

            splittedArr.push(String(counter));
            this.file = splittedArr.join(".");
            counter++;
        }
        // console.log("Log file: ", this.file);
    }

    /**
     * Writing log into file
     *
     * @param data string
     */
    public write(data: string) {
        // console.log("Logging data to file : ", data);
        fs.appendFile(this.file, data, (err) => {
            if (err) {
                throw err;
            }
            // console.log('The data was appended to file!');
        });
    }

    private fileExists(file?: string): boolean {
        return fs.existsSync(file || this.file);
    }

    private fileSize(file?: string): number {
        return fs.statSync(file || this.file).size;
    }

    private fileSizeInMBs(file?: string): number {
        return this.fileSize(file || this.file) / 1000000.0;
    }

}