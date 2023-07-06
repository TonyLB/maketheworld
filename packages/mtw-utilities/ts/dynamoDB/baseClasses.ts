import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

//
// TODO: Layer in methods to DBHandler as mixin files
//

export type Constructor<T = {}> = new (...a: any[]) => T

export const remap = <
    K extends string,
    S extends K,
    T extends { [key in K]: any },
    V extends string, // needed to force string literal types for mapping values
    U extends { [P in S]: V }
>(original: T, mapping: U) => {
    const remapped: any = {};

    Object.keys(original).forEach(k => {
        if (mapping[k]) {
            remapped[mapping[k]] = original[k];
        }
        else {
            remapped[k] = original[k]
        }
    })
    return remapped as (Omit<T, keyof U> & {
        // Take all the values in the map, 
        // so given { a: 'Hello', b: 'World', c: '!!!' }  U[keyof U] will produce 'Hello' | 'World' | '!!!'
        [P in keyof U as U[P]]: [T] extends [{ [key in P]: unknown }] ? T[P] : never
    })
}

const remapped = remap(
    { a: 1, b: 'text', c: new Date() },
    { a: 'Hello', b: 'World' }
  );

export class DBHandlerBase<KIncoming extends string, KInternal extends string, KeyType extends string> {
    _client: InstanceType<typeof DynamoDBClient>;
    _incomingKeyLabel: KIncoming;
    _internalKeyLabel: KInternal;
    _tableName: string;
    _writeBatchSize?: number;
    _getBatchSize?: number;

    constructor(props: {
        client: InstanceType<typeof DynamoDBClient>;
        tableName: string;
        incomingKeyLabel: KIncoming;
        internalKeyLabel: KInternal;
        options: {
            primaryKeyTypeGuard?: (value: string) => value is KeyType;
            writeBatchSize?: number;
            getBatchSize?: number;
        }
    }, ...rest: any[]) {
        this._client = props.client
        this._tableName = props.tableName
        this._incomingKeyLabel = props.incomingKeyLabel
        this._internalKeyLabel = props.internalKeyLabel
        this._writeBatchSize = props.options.writeBatchSize
        this._getBatchSize = props.options.getBatchSize
    }

    _remapIncomingObject <T extends (Record<string, any> & { [key in KIncoming]: KeyType })>(value: T) {
        return remap(value, { [this._incomingKeyLabel]: this._internalKeyLabel } as { [key in KIncoming]: KInternal })
    }

    _remapOutgoingObject <T extends (Record<string, any> & { [key in KInternal]: KeyType })>(value: T) {
        return remap(value, { [this._internalKeyLabel]: this._incomingKeyLabel } as { [key in KInternal]: KIncoming })
    }
}
