import { ComponentUUID, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema";
import { checkTypes } from "./typeguards";

export interface ComponentKey {
    key?: string;
    universalKey?: ComponentUUID;
    fileName?: string;
}

export const hasComponentKey = (arg: any): arg is ComponentKey => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkTypes(
        arg,
        { key: 'string' },
        {
            universalKey: 'string',
            fileName: 'string'
        }
    ) && (!arg.universalKey || isSchemaComponentUUID(arg.universalKey))
}
