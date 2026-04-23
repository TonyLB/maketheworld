import { isRenderTreeNode, RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaTreeNode } from "../../../schema"
import { isStandardLiteralData } from "../../literal"
import { isStandardReferenceData } from "./reference"
import { editWrappedTypeguard, StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isStandardFacetData, isStandardFacetEnvelopeWithOptionalPayload } from "../../keys/facets/dataTypes/facet"

// Typeguard to check if a value is a RenderTree (array of RenderTreeNode)
const isRenderTreeArray = (value: any): value is RenderTree => {
    return Array.isArray(value) && value.every(isRenderTreeNode)
}

export const checkAll = (...items: boolean[]): boolean => (
    items.reduce<boolean>((previous, item) => (previous && item), true)
)

type CheckType = 'node' | 'tree' | 'referenceList' | 'facetList' | 'facetListInput' | 'renderTree' | 'literal' | 'string' | 'number' | 'boolean' | 'key'

export const checkTypes = (item: any, requiredList: Record<string, CheckType>, optionalList?: Record<string, CheckType>): boolean => {
    const checkSingleType = (value: any, type: CheckType): boolean => {
        switch(type) {
            case 'node':
                return isSchemaTreeNode(value)
            case 'tree':
                if (!Array.isArray(value)) {
                    return false
                }
                return value.every(isSchemaTreeNode)
            case 'renderTree':
                // renderTree can be RenderTree (array) or StandardEditableData<RenderTree> (for Replace/Remove structures)
                if (Array.isArray(value)) {
                    return value.every(isRenderTreeNode)
                }
                // Handle StandardEditableData<RenderTree> format (e.g., { tag: 'Remove', match: RenderTree } or { tag: 'Replace', match: RenderTree, payload: RenderTree })
                return editWrappedTypeguard(isRenderTreeArray)(value)
            case 'literal':
                return isStandardLiteralData(value)
            case 'referenceList':
                if (!Array.isArray(value)) {
                    return false
                }
                return value.every(isStandardReferenceData)
            case 'facetList':
                if (!Array.isArray(value)) {
                    return false
                }
                return value.every((item) => editWrappedTypeguard(isStandardFacetData)(item))
            case 'facetListInput':
                if (!Array.isArray(value)) {
                    return false
                }
                return value.every((item) => editWrappedTypeguard(isStandardFacetEnvelopeWithOptionalPayload)(item))
            case 'key':
                // key can be string or StandardEditableData<string> (for Replace/Remove structures)
                return typeof value === 'string' || 
                    editWrappedTypeguard((x: any): x is string => typeof x === 'string')(value)
            default:
                return typeof(value) === type
        }
    }
    if (typeof item !== 'object') {
        // console.log(`Not of type item: ${JSON.stringify(item, null, 4)}`)
        return false
    }
    if (!Object.entries(requiredList).reduce<boolean>((previous, [key, typeString]) => (
        previous && key in item && checkSingleType(item[key], typeString)
    ), true)) {
        return false
    }
    if (!Object.entries(optionalList || {}).reduce<boolean>((previous, [key, typeString]) => (
        previous && ((!(key in item)) || typeof item[key] === 'undefined' || checkSingleType(item[key], typeString))
    ), true)) {
        // console.log(`Failed optional types: ${JSON.stringify(item, null, 4)}`)
        return false
    }
    return true
}
