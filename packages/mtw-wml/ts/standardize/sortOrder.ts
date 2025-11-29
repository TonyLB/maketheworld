import { ComponentTag } from "./components/dataTypes/abstract"
import { StandardReferenceSimple, StandardKey } from "./components/reference"

type SortKey = StandardReferenceSimple | StandardKey
type LookupResult = { reference: StandardReferenceSimple; implicitParent?: StandardKey }
type LookupFunction = (key: StandardKey) => LookupResult | undefined

/**
 * Builds an ancestry chain for a given key using the lookup function.
 * Returns the full chain including the current key with its tag (derived from the lookup result).
 */
const buildAncestryChain = (
    key: StandardKey,
    lookup: LookupFunction
): StandardReferenceSimple[] => {
    const lookupResult = lookup(key)
    
    if (!lookupResult) {
        // If lookup result not found, try to derive tag from key's universalKey
        const tag = key.tag
        if (!tag) {
            throw new Error(`Cannot determine tag for key in sortOrder: ${JSON.stringify(key)}`)
        }
        return [new StandardReferenceSimple(key, tag)]
    }
    
    // Get tag from reference
    const componentTag = lookupResult.reference.tag
    if (!componentTag) {
        throw new Error(`Cannot determine tag for reference in sortOrder: ${JSON.stringify(key)}`)
    }
    
    // Build ancestry chain by traversing implicitParent
    const ancestryChain: StandardReferenceSimple[] = []
    let current: LookupResult | undefined = lookupResult
    
    while (current?.implicitParent) {
        const parentKey = current.implicitParent
        const parentLookupResult = lookup(parentKey)
        
        if (!parentLookupResult) {
            // Parent not found, try to derive tag from parentKey
            const parentTag = parentKey.tag
            if (!parentTag) {
                throw new Error(`Cannot determine tag for parent in ancestry chain: ${JSON.stringify(parentKey)}`)
            }
            ancestryChain.push(new StandardReferenceSimple(parentKey, parentTag))
            break
        }
        
        // Use parent reference directly
        ancestryChain.push(parentLookupResult.reference)
        current = parentLookupResult
    }
    
    // Reverse to get order from Asset level (earliest) to direct parent (most proximate)
    ancestryChain.reverse()
    
    // Return full chain including current key
    return [...ancestryChain, lookupResult.reference]
}

export const standardComponentSortOrder = (
    referenceA: SortKey,
    referenceB: SortKey,
    lookup: LookupFunction
): number => {
    //
    // Subcomponents will have keys that include their context of ancestry.
    // First compare the two keys to see if one is a subcomponent of the other. If so, the subcomponent should come second.
    // Next, see if the two keys have ancestors not in common:  If so, compare the first differing ancestor in place
    // of the key provided.
    // Lastly, if they are in the same context, compare the tags and then the keys.
    //
    
    // Extract keys from references if needed
    const keyA = referenceA instanceof StandardReferenceSimple ? referenceA.standardKey : referenceA
    const keyB = referenceB instanceof StandardReferenceSimple ? referenceB.standardKey : referenceB
    
    // Build ancestry chains using lookup (includes current keys with tags)
    const fullChainA = buildAncestryChain(keyA, lookup)
    const fullChainB = buildAncestryChain(keyB, lookup)
    
    const differingIndex = fullChainA.findIndex((ancestorEntry, index) => (!((fullChainB.length > index) && fullChainB[index].standardKey.equals(ancestorEntry.standardKey))))
    if (differingIndex === -1 || differingIndex >= fullChainB.length) {
        return fullChainA.length - fullChainB.length
    }
    else {
        const elementToCompareA = fullChainA[differingIndex]
        const elementToCompareB = fullChainB[differingIndex]
        
        const componentKeys: ComponentTag[] = ['Character', 'Image', 'Feature', 'Knowledge', 'Room', 'Map', 'Message', 'Moment']
        const tagA = elementToCompareA.tag
        const tagB = elementToCompareB.tag
        const indexA = componentKeys.indexOf(tagA)
        const indexB = componentKeys.indexOf(tagB)
        if (indexA !== indexB) {
            return indexA - indexB
        }
        else {
            return (elementToCompareA.standardKey.key ?? '').localeCompare(elementToCompareB.standardKey.key ?? '')
        }
    }
}
