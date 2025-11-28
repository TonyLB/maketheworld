import { ComponentTag } from "./components/dataTypes/abstract"
import { StandardReferenceSimple, StandardKey } from "./components/reference"
import { StandardComponent } from "./components/baseClasses"
import { StandardRemove, StandardReplace } from "./components/edits"

type SortKey = StandardReferenceSimple | StandardKey
type AncestryChainEntry = { key: StandardKey, tag: ComponentTag }
type LookupFunction = (key: StandardKey) => StandardComponent | undefined

/**
 * Builds an ancestry chain for a given key using the lookup function.
 * Returns the full chain including the current key with its tag (derived from the component via lookup).
 */
const buildAncestryChain = (
    key: StandardKey,
    lookup: LookupFunction
): AncestryChainEntry[] => {
    const component = lookup(key)
    
    if (!component) {
        // If component not found, try to derive tag from key's universalKey
        const tag = key.tag
        if (!tag) {
            throw new Error(`Cannot determine tag for key in sortOrder: ${JSON.stringify(key)}`)
        }
        return [{ key, tag }]
    }
    
    // Get tag from component
    // For 'Remove' and 'Replace' components, derive tag from their _match property
    let componentTag: ComponentTag | undefined
    if (component instanceof StandardRemove) {
        componentTag = component._match.tag && component._match.tag !== 'Remove' && component._match.tag !== 'Replace'
            ? component._match.tag
            : undefined
    } else if (component instanceof StandardReplace) {
        componentTag = component._match.tag && component._match.tag !== 'Remove' && component._match.tag !== 'Replace'
            ? component._match.tag
            : undefined
    } else {
        componentTag = component.tag && component.tag !== 'Remove' && component.tag !== 'Replace'
            ? component.tag
            : undefined
    }
    
    // Fallback to key.tag if component tag couldn't be determined
    if (!componentTag) {
        componentTag = key.tag ?? undefined
    }
    
    if (!componentTag) {
        throw new Error(`Cannot determine tag for component in sortOrder: ${JSON.stringify(key)}`)
    }
    
    // Build ancestry chain by traversing implicitParent
    const ancestryChain: AncestryChainEntry[] = []
    let current: StandardComponent | undefined = component
    
    while (current?.implicitParent) {
        const parentKey = current.implicitParent
        const parentComponent = lookup(parentKey)
        
        if (!parentComponent) {
            // Parent component not found, try to derive tag from parentKey
            const parentTag = parentKey.tag
            if (!parentTag) {
                throw new Error(`Cannot determine tag for parent in ancestry chain: ${JSON.stringify(parentKey)}`)
            }
            ancestryChain.push({ key: parentKey, tag: parentTag })
            break
        }
        
        // For 'Remove' and 'Replace' components, derive tag from their _match property
        let parentTag: ComponentTag
        if (parentComponent instanceof StandardRemove || parentComponent instanceof StandardReplace) {
            parentTag = parentComponent._match.tag as ComponentTag
        } else {
            parentTag = parentComponent.tag as ComponentTag
        }
        
        ancestryChain.push({ key: parentKey, tag: parentTag })
        current = parentComponent
    }
    
    // Reverse to get order from Asset level (earliest) to direct parent (most proximate)
    ancestryChain.reverse()
    
    // Return full chain including current key
    return [...ancestryChain, { key, tag: componentTag }]
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
    
    const differingIndex = fullChainA.findIndex((ancestorEntry, index) => (!((fullChainB.length > index) && fullChainB[index].key.equals(ancestorEntry.key))))
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
            return (elementToCompareA.key.key ?? '').localeCompare(elementToCompareB.key.key ?? '')
        }
    }
}
