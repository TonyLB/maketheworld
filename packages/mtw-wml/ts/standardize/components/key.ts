//
// The KeyPayload class holds key information (including information like universalKey and import/export
// that are only relevant in serialization) for a StandardComponent class
//

import { ComponentUUID, isSchemaComponentTag, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema";
import { SerializeNDJSONMixin } from "../baseClasses";
import { ComponentKey } from "./dataTypes/key"
import { isLegalKey } from "../utils";

export class KeyPayload {
    _key?: string;
    _universalKey?: ComponentUUID;
    _fileName?: string;

    constructor(props: string | ComponentKey | KeyPayload) {
        if (props instanceof KeyPayload) {
            this._key = props.key
            this._universalKey = props.universalKey
            this._fileName = props.fileName
            return
        }
        if (typeof props === 'string') {
            if (isSchemaComponentUUID(props)) {
                this._universalKey = props
                return
            }
            if (isLegalKey(props)) {
                this._key = props
                return
            }
            throw new Error(`KeyPayload constructor: '${props}' is not a valid key`)
        }
        this._key = props.key
        this._universalKey = props.universalKey
        this._fileName = props.fileName
    }

    get key() { return this._key }
    get universalKey() { return this._universalKey }
    get fileName() { return this._fileName }

    toJSON(options?: { stripUniversalKey?: boolean }): { key?: string } & SerializeNDJSONMixin {
        return {
            key: this.key,
            ...(options?.stripUniversalKey ? {} : { universalKey: this.universalKey }),
            fileName: this.fileName
        }
    }
}