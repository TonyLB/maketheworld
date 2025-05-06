import { isRenderTreeNode } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaTreeNode } from "../utils"
import { isStandardLiteralData } from "../../literal"
import { isStandardReferencePayloadData } from "./reference"

export const checkAll = (...items: boolean[]): boolean => (
    items.reduce<boolean>((previous, item) => (previous && item), true)
)

type CheckType = 'node' | 'tree' | 'referenceList' | 'renderTree' | 'literal' | 'string' | 'number' | 'boolean'

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
                if (!Array.isArray(value)) {
                    return false
                }
                return value.every(isRenderTreeNode)
            case 'literal':
                return isStandardLiteralData(value)
            case 'referenceList':
                if (!Array.isArray(value)) {
                    return false
                }
                return value.every(isStandardReferencePayloadData)
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
