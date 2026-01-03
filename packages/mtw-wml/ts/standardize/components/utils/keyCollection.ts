import { StandardKey } from "../../keys/key"
import StandardReference from "../../keys/reference"

/**
 * KeyCollection manages a deduplicated collection of StandardKey appearances.
 * 
 * Keys are matched using StandardKey.equals(), which considers two keys equal
 * if they share either the same key or the same universalKey.
 * 
 * When keys are added:
 * - If a key matches a less-specified key in the collection, it merges information
 * - If a key matches multiple keys in the collection, all matching keys are removed
 *   and replaced with the more-specific merged key
 */
export class KeyCollection {
    private _keys: StandardKey[]

    constructor(keys: StandardKey[] = []) {
        this._keys = keys.reduce((acc, key) => {
            return this._addKeyToCollection(acc, key)
        }, [] as StandardKey[])
    }

    get keys(): StandardKey[] {
        return this._keys
    }

    clone(): KeyCollection {
        const returnValue = new KeyCollection([])
        returnValue._keys = this._keys.map(key => key.clone())
        return returnValue
    }

    withKey(key: StandardKey): KeyCollection {
        const returnValue = this.clone()
        returnValue._keys = this._addKeyToCollection(returnValue._keys, key)
        return returnValue
    }

    /**
     * Looks up a key in the collection.
     * Returns the matching key from the collection, or undefined if not found.
     * 
     * Throws an error if the query key matches multiple keys in the collection
     * (ambiguous match).
     */
    lookup(query: StandardKey): StandardKey | undefined {
        const matches = this._keys.filter(existing => query.equals(existing))
        
        if (matches.length === 0) {
            return undefined
        }
        
        if (matches.length > 1) {
            throw new Error(
                `Ambiguous key lookup: query key ${JSON.stringify(query.toJSON())} matches multiple keys in collection: ` +
                matches.map(k => JSON.stringify(k.toJSON())).join(', ')
            )
        }
        
        return matches[0].clone()
    }

    private _addKeyToCollection(collection: StandardKey[], newKey: StandardKey): StandardKey[] {
        const matches = collection.filter(existing => newKey.equals(existing))
        
        if (matches.length === 0) {
            // No matches, just add the new key
            return [...collection, newKey.clone()]
        }
        
        // Merge all matching keys with the new key
        // Start with the new key and merge in all matches
        // This ensures we get the most complete representation (with both key and universalKey if available)
        let merged = newKey.clone()
        for (const match of matches) {
            try {
                merged = merged.merge(match)
            } catch (error) {
                // If merge fails due to conflict (e.g., mismatched universalKeys for same key),
                // throw a more descriptive error
                throw new Error(
                    `Cannot merge conflicting keys: ${JSON.stringify(merged.toJSON())} and ${JSON.stringify(match.toJSON())}. ` +
                    `Keys match according to equals() but cannot be merged.`
                )
            }
        }
        
        // Remove all matches and add the merged result
        const withoutMatches = collection.filter(existing => !newKey.equals(existing))
        return [...withoutMatches, merged]
    }
}

