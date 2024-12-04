//
// The KeyPayload class holds key information (including information like universalKey and import/export
// that are only relevant in serialization) for a StandardComponent class
//

import { SerializeNDJSONMixin } from "../baseClasses";
import { ComponentKey } from "./dataTypes/key"

export class KeyPayload {
    _key: string;
    _universalKey?: string;
    _fileName?: string;

    constructor(props: string | ComponentKey) {
        if (typeof props === 'string') {
            this._key = props
            return
        }
        this._key = props.key
        this._universalKey = props.universalKey
        this._fileName = props.fileName
    }

    get key() { return this._key }
    get universalKey() { return this._universalKey }
    get fileName() { return this._fileName }

    toJSON(): { key: string } & SerializeNDJSONMixin {
        return {
            key: this.key,
            universalKey: this.universalKey,
            fileName: this.fileName
        }
    }
}