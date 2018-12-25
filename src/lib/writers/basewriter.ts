import { LogWriter } from "../../models";

/**
 * Base or Default Writer class uses stdout for log writing
 */
export class Writer implements LogWriter {

    public storageExhausted(): boolean {
        return false;
    }

    public cleanUp() {
        // implement this method in child class
    }

    public write(data: string) {
        process.stdout.write(data);
    }
}
