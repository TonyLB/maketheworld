import { ComponentUUID, isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag, componentTagFromUniversalKey } from "../components/dataTypes/abstract";
import { StandardKeyData, StandardReferenceData } from "./dataTypes/reference";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { StandardEditablePayload } from "../../generics/editable";
import { ReferenceFormat } from "../components/utils/references";
import { referenceSortOrder } from "./reference";

export class StandardKey implements StandardEditablePayload<StandardKeyData> {
    key?: string;
    universalKey?: ComponentUUID;
    constructor(data: string | { key?: string; universalKey?: ComponentUUID } | StandardKeyData | StandardReferenceData | StandardKey) {
        // Handle StandardKey instance directly (for cloning)
        if (data instanceof StandardKey) {
            this.key = data.key
            this.universalKey = data.universalKey
            return
        }
        
        if (typeof data === 'string') {
            if (!isSchemaComponentUUID(data)) {
                console.log(`Invalid StandardKeyData passed to StandardKey: ${JSON.stringify(data, null, 4)}`)
                throw new Error('Invalid StandardKeyData passed to StandardKey')
            }
            this.universalKey = data
        }
        else {
            if (!data.key && !data.universalKey) {
                throw new Error('StandardKey must have a key or universalKey')
            }
            this.key = data.key
            this.universalKey = data.universalKey
        }
    }
    get tag(): ComponentTag | undefined {
        if (typeof this.universalKey === 'undefined') {
            return undefined
        }
        return componentTagFromUniversalKey(this.universalKey)
    }
    get schema() {
        const tag = this.tag
        if (tag === undefined) {
            throw new Error('StandardKey.schema requires tag to be derivable from universalKey')
        }
        return [{
            data: {
                tag,
                key: this.key,
                uuid: this.universalKey
            } as SchemaTag,
            children: []
        }]
    }
    clone() {
        return new StandardKey(this)
    }
    toJSON: () => StandardKeyData = () => {
        // StandardKeyData preserves both key and universalKey (unlike StandardReferenceData which requires tag)
        if (this.universalKey && !this.key) {
            return this.universalKey
        }
        if (this.key) {
            return { key: this.key, universalKey: this.universalKey }
        }
        throw new Error('StandardKey must have a universalKey or key')
    }
    withKey(key: string): StandardKey {
        const returnValue = this.clone()
        returnValue.key = key
        return returnValue
    }
    // context support has been removed; hierarchical relationships are handled at the component level
    
    equals(other: StandardKey): boolean {
        //
        // Returns if the two objects share either the same key or the same universalKey,
        // and have no other differences
        //
        // Compare tags if both can be derived
        const thisTag = this.tag
        const otherTag = other.tag
        if (thisTag !== undefined && otherTag !== undefined && thisTag !== otherTag) {
            return false
        }
        if (this.universalKey && other.universalKey && this.universalKey !== other.universalKey) {
            return false
        }
        if (this.key && other.key && this.key !== other.key) {
            return false
        }
        if (this.key === other.key || this.universalKey === other.universalKey) {
            return true
        }
        return false
    }

    merge(other: StandardKey): StandardKey {
        const returnValue = this.clone()
        if (other.key) {
            returnValue.key = other.key
        }
        if (other.universalKey && returnValue.universalKey && returnValue.universalKey !== other.universalKey) {
            throw new MergeConflictError('Mismatched universalKeys in StandardKey merge')
        }
        if (other.universalKey) {
            returnValue.universalKey = other.universalKey
        }
        return returnValue
    }

    toFormat(format: ReferenceFormat): StandardKey {
        if (format === 'both') {
            return this.clone()
        }
        const returnValue = this.clone()
        if (format === 'key') {
            if (returnValue.key) {
                returnValue.universalKey = undefined
            }
        }
        else {
            if (returnValue.universalKey) {
                returnValue.key = undefined
            }
        }
        return returnValue
    }

}

/**
 * Sort order function for StandardKey objects.
 * 
 * Sorting rules:
 * 1. Keys with `universalKey` come before keys without
 * 2. For keys with `universalKey`: Use `referenceSortOrder` logic (compares by tag then key)
 * 3. For keys without `universalKey` (local-only): Sort alphabetically by local `key`
 * 
 * @param keyA - First key to compare
 * @param keyB - Second key to compare
 * @returns Negative if A < B, positive if A > B, zero if equal
 */
export const keySortOrder = (keyA: StandardKey, keyB: StandardKey): number => {
    // Keys with universalKey come before keys without
    const hasUniversalKeyA = Boolean(keyA.universalKey)
    const hasUniversalKeyB = Boolean(keyB.universalKey)
    
    if (hasUniversalKeyA && !hasUniversalKeyB) {
        return -1
    }
    if (!hasUniversalKeyA && hasUniversalKeyB) {
        return 1
    }
    
    // Both have universalKey or both don't
    if (hasUniversalKeyA && hasUniversalKeyB) {
        // Use referenceSortOrder logic for keys with universalKey
        return referenceSortOrder(keyA, keyB)
    } else {
        // Both are local-only - sort alphabetically by local key
        const keyAStr = keyA.key ?? ''
        const keyBStr = keyB.key ?? ''
        return keyAStr.localeCompare(keyBStr)
    }
}
