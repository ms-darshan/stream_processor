class MongoSchema {
    private schemaList: any;
    private schemaStructure: any;
    private queryList: any;
    private queryStructure: any;
    private indexList: any;
    private indexStructure: any;

    constructor() {
        this.init();
    }

    public getSchema(db: string, schema: string) {
        if (db in this.schemaStructure) {
            if (schema in this.schemaStructure[db]) {
                return this.schemaStructure[db][schema];
            }
        }
        return false;
    }

    public getQuery(db: string, schema: string) {
        if (db in this.queryStructure) {
            if (schema in this.queryStructure[db]) {
                return this.queryStructure[db][schema];
            }
        }
        return false;
    }

    public getIndex(db: string, schema: string) {
        if (db in this.indexStructure) {
            if (schema in this.indexStructure[db]) {
                return this.indexStructure[db][schema];
            }
        }
        return false;
    }

    public getSchemaList(db: string) {
        if (db in this.schemaList) {
            return this.schemaList[db];
        }
        return false;
    }

    public getQueryList(db: string) {
        if (db in this.queryList) {
            return this.queryList[db];
        }
        return false;
    }

    public getIndexList(db: string) {
        if (db in this.indexList) {
            return this.indexList[db];
        }
        return false;
    }

    private init() {
        this.schemaList = { "feed": ["content"] };
        this.queryList = { };
		this.indexList = { "feed": ["content"]};
        this.schemaStructure = {
            feed: {
                content: {
                    bsonType: "object",
                    required: [],
                    properties: {
					
					}
				}
			}
        };

        this.queryStructure = {
		
		}

		this.indexStructure = {
			hogwarts: {
				content: [
					{ refid: 1, type: 1 }
				]
			}
		};
    }
}

export default {
    mongoSchema: MongoSchema,
};
