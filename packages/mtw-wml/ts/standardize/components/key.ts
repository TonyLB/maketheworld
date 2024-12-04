//
// The KeyPayload class holds key information (including information like universalKey and import/export
// that are only relevant in serialization) for a StandardComponent class
//

import { ComponentKey } from "./dataTypes/key"

export class KeyPayload {
    _key: string;
    _universalKey?: string;

    constructor(props: string | ComponentKey) {
        if (typeof props === 'string') {
            this._key = props
            return
        }
        this._key = props.key
        this._universalKey = props.universalKey
    }

    get key() { return this._key }
    get universalKey() { return this._universalKey }

    toJSON(): { key: string; universalKey?: string } {
        return {
            key: this.key,
            universalKey: this.universalKey
        }
    }
}