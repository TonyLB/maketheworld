import { ComponentTag } from "./components/dataTypes/abstract"
import { StandardReferenceSimple, StandardKey } from "./components/reference"

export const standardComponentSortOrder = (referenceA: StandardReferenceSimple | StandardKey, referenceB: StandardReferenceSimple | StandardKey): number => {
    //
    // Subcomponents will have keys that include their context of ancestry.
    // First compare the two keys to see if one is a subcomponent of the other. If so, the subcomponent should come second.
    // Next, see if the two keys have ancestors not in common:  If so, compare the first differing ancestor in place
    // of the key provided.
    // Lastly, if they are in the same context, compare the tags and then the keys.
    //
    const baseA = referenceA instanceof StandardReferenceSimple ? referenceA.payload : referenceA
    const baseB = referenceB instanceof StandardReferenceSimple ? referenceB.payload : referenceB
    if ((baseA.context ?? []).some(baseB.equals.bind(baseB))) {
        return -1
    }
    if ((baseB.context ?? []).some(baseA.equals.bind(baseA))) {
        return 1
    }
    const differingA: StandardKey | undefined = (referenceA.context ?? []).find((reference) => (!referenceB.context?.some(reference.equals.bind(reference))))
    const differingB: StandardKey | undefined = (referenceB.context ?? []).find((reference) => (!referenceA.context?.some(reference.equals.bind(reference))))
    const elementToCompareA = differingA
        ? new StandardReferenceSimple(differingA.toJSON())
        : referenceA
    const elementToCompareB = differingB
        ? new StandardReferenceSimple(differingB.toJSON())
        : referenceB
    
    const componentKeys: ComponentTag[] = ['Character', 'Image', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
    const indexA = componentKeys.indexOf(elementToCompareA.tag)
    const indexB = componentKeys.indexOf(elementToCompareB.tag)
    if (indexA !== indexB) {
        return indexA - indexB
    }
    else {
        return (elementToCompareA.key ?? '').localeCompare(elementToCompareB.key ?? '')
    }
}
