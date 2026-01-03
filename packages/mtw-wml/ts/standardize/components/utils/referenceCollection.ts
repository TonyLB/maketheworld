import { StandardReference } from "../reference"
import { StandardKey } from "../../keys/key"

/**
 * ReferenceCollection manages a deduplicated collection of StandardReference appearances.
 * 
 * References are matched using StandardReference.standardKey.equals(), which considers
 * two references equal if they share either the same key or the same universalKey.
 * 
 * When references are added:
 * - If a reference matches a less-specified reference in the collection, it merges information
 * - If a reference matches multiple references in the collection, all matching references are
 *   removed and replaced with the more-specific merged reference
 * 
 * Unlike KeyCollection, ReferenceCollection stores references with tag information,
 * which allows for complete StandardReferenceData representation.
 */
export class ReferenceCollection {
    private _references: StandardReference[]

    constructor(references: StandardReference[] = []) {
        this._references = references.reduce((acc, reference) => {
            return this._addReferenceToCollection(acc, reference)
        }, [] as StandardReference[])
    }

    get references(): StandardReference[] {
        return this._references
    }

    clone(): ReferenceCollection {
        const returnValue = new ReferenceCollection([])
        returnValue._references = this._references.map(ref => ref.clone())
        return returnValue
    }

    withReference(reference: StandardReference): ReferenceCollection {
        const returnValue = this.clone()
        returnValue._references = this._addReferenceToCollection(returnValue._references, reference)
        return returnValue
    }

    /**
     * Looks up a reference in the collection by matching StandardKey.
     * Returns the matching reference from the collection, or undefined if not found.
     * 
     * Throws an error if the query key matches multiple references in the collection
     * (ambiguous match).
     */
    lookup(query: StandardKey): StandardReference | undefined {
        const matches = this._references.filter(existing => query.equals(existing.standardKey))
        
        if (matches.length === 0) {
            return undefined
        }
        
        if (matches.length > 1) {
            throw new Error(
                `Ambiguous reference lookup: query key ${JSON.stringify(query.toJSON())} matches multiple references in collection: ` +
                matches.map(r => JSON.stringify(r.toJSON())).join(', ')
            )
        }
        
        return matches[0].clone()
    }

    /**
     * Internal helper to add a reference to a collection, merging and deduplicating as needed.
     * 
     * Strategy:
     * 1. Find all references in the collection that match the new reference (using standardKey.equals())
     * 2. If matches found:
     *    - Merge all matching references with the new reference to create the most complete representation
     *    - Remove all matching references and add the merged result
     *    - This handles the case where a reference appears as both { key } and { universalKey }
     *      - They match each other, so they get merged into { key, universalKey, tag }
     * 3. If no matches, add the new reference as-is
     */
    private _addReferenceToCollection(collection: StandardReference[], newReference: StandardReference): StandardReference[] {
        const matches = collection.filter(existing => newReference.standardKey.equals(existing.standardKey))
        
        if (matches.length === 0) {
            // No matches, just add the new reference
            return [...collection, newReference.clone()]
        }
        
        // Merge all matching references with the new reference
        // Merge the StandardKey portions and verify tags match
        let mergedKey: StandardKey = newReference.standardKey.clone()
        const tag = newReference.tag
        
        // Check that all matching references have the same tag
        for (const match of matches) {
            if (match.tag !== tag) {
                throw new Error(
                    `Cannot merge references with different tags: ${tag} and ${match.tag} for key ${JSON.stringify(mergedKey.toJSON())}`
                )
            }
            // Merge the StandardKey portions
            try {
                mergedKey = mergedKey.merge(match.standardKey)
            } catch (error) {
                // If merge fails due to conflict, throw a more descriptive error
                throw new Error(
                    `Cannot merge conflicting reference keys: ${JSON.stringify(mergedKey.toJSON())} and ${JSON.stringify(match.standardKey.toJSON())}. ` +
                    `References match according to standardKey.equals() but cannot be merged.`
                )
            }
        }
        
        // Create merged reference from the merged key and tag
        const merged = new StandardReference(mergedKey, tag)
        
        // Remove all matches and add the merged result
        const withoutMatches = collection.filter(existing => !newReference.standardKey.equals(existing.standardKey))
        return [...withoutMatches, merged]
    }
}

