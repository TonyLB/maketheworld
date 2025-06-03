import { ComponentTag } from "./components/dataTypes/abstract"
import { StandardReferenceSimple } from "./components/reference"

export const standardComponentSortOrder = (lookup: (value: string) => StandardReferenceSimple) => (referenceA: StandardReferenceSimple, referenceB: StandardReferenceSimple): number => {
    //
    // Subcomponents will have keys that start with their ancestry, separated by periods (i.e. "Room1.Feature1").
    // First compare the two keys to see if one is a subcomponent of the other. If so, the subcomponent should come second.
    // Next, see if the two keys have ancestors not in common:  If so, use the passed byId object to look up the
    // ancestor(s) and compare against those instead.
    // Finally, if they are peers in terms of ancestry, compare the two keys directly.
    //
    const keyA = referenceA.key ?? ''
    const keyB = referenceB.key ?? ''
    if (keyA.startsWith(`${keyB}.`)) {
        return 1
    }
    if (keyB.startsWith(`${keyA}.`)) {
        return -1
    }
    const ancestorsA = keyA.split('.').slice(0, -1)
    const ancestorsB = keyB.split('.').slice(0, -1)
    const { commonAncestors } = ancestorsA.reduce<{ commonAncestors: string[]; differenceHasOccurred: boolean }>((previous, ancestor, index) => {
        if (previous.differenceHasOccurred) {
            return previous
        }
        if (ancestorsB[index] === ancestor) {
            return { ...previous, commonAncestors: [...previous.commonAncestors, ancestor] }
        }
        return { ...previous, differenceHasOccurred: true }
    }, { commonAncestors: [], differenceHasOccurred: false })
    const commonAncestorString = commonAncestors.join('.')

    const differingAncestorsA = ancestorsA.slice(commonAncestors.length)
    const differingAncestorsB = ancestorsB.slice(commonAncestors.length)

    const elementToCompareA = differingAncestorsA.length ? lookup([commonAncestorString, differingAncestorsA[0]].filter((value) => (value)).join('.')) : referenceA
    const elementToCompareB = differingAncestorsB.length ? lookup([commonAncestorString, differingAncestorsB[0]].filter((value) => (value)).join('.')) : referenceB
    
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
