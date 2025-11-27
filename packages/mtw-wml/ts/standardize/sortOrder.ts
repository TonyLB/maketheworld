import { ComponentTag } from "./components/dataTypes/abstract"
import { StandardReferenceSimple, StandardKey } from "./components/reference"

type SortKey = StandardReferenceSimple | StandardKey
type GetAncestryChainFunction = (key: StandardKey) => StandardKey[]

export const standardComponentSortOrder = (
    referenceA: SortKey,
    referenceB: SortKey,
    getAncestryChain: GetAncestryChainFunction
): number => {
    //
    // Subcomponents will have keys that include their context of ancestry.
    // First compare the two keys to see if one is a subcomponent of the other. If so, the subcomponent should come second.
    // Next, see if the two keys have ancestors not in common:  If so, compare the first differing ancestor in place
    // of the key provided.
    // Lastly, if they are in the same context, compare the tags and then the keys.
    //
    
    // Extract keys from references if needed
    const keyA = referenceA instanceof StandardReferenceSimple ? referenceA.payload : referenceA
    const keyB = referenceB instanceof StandardReferenceSimple ? referenceB.payload : referenceB
    
    // Get ancestry chains (equivalent to old context arrays)
    const chainA = [...getAncestryChain(keyA), keyA]
    const chainB = [...getAncestryChain(keyB), keyB]
    
    const differingIndex = chainA.findIndex((ancestorKey, index) => (!((chainB.length > index) && chainB[index].equals(ancestorKey))))
    if (differingIndex === -1 || differingIndex >= chainB.length) {
        return chainA.length - chainB.length
    }
    else {
        const elementToCompareA = chainA[differingIndex]
        const elementToCompareB = chainB[differingIndex]
        
        const componentKeys: ComponentTag[] = ['Character', 'Image', 'Feature', 'Knowledge', 'Room', 'Map', 'Message', 'Moment']
        const indexA = componentKeys.indexOf(elementToCompareA.tag)
        const indexB = componentKeys.indexOf(elementToCompareB.tag)
        if (indexA !== indexB) {
            return indexA - indexB
        }
        else {
            return (elementToCompareA.key ?? '').localeCompare(elementToCompareB.key ?? '')
        }
    }
}
