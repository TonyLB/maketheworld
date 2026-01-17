import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { ParsePropertyTypes, ParseTagOpen, ParseTagSelfClosure } from "../../simpleParser/baseClasses"
import { ConverterMapValidateProperties, PrintMapOptionsChange, PrintMapOptionsFactory, ValidationTemplate, ValidationTemplateOutput } from "./baseClasses"
import { AssetUUID, isSchemaAssetUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"

/**
 * Parses and validates a comma-separated pair of coordinates from an expression value.
 * Throws an error if the value cannot be parsed as exactly two numbers.
 */
export const parsePositionCoordinates = (value: string, propertyName: string, tagName: string): { x: number, y: number } => {
    const trimmed = value.trim()
    if (!trimmed) {
        throw new Error(`Property '${propertyName}' must contain exactly two comma-separated numbers in '${tagName}' items, but received empty value.`)
    }
    const parts = trimmed.split(',').map(part => part.trim()).filter(part => part.length > 0)
    if (parts.length !== 2) {
        throw new Error(`Property '${propertyName}' must contain exactly two comma-separated numbers in '${tagName}' items, but received '${value}' (found ${parts.length} values).`)
    }
    const x = Number.parseInt(parts[0], 10)
    const y = Number.parseInt(parts[1], 10)
    if (Number.isNaN(x) || !Number.isFinite(x)) {
        throw new Error(`Property '${propertyName}' contains invalid number in '${tagName}' items: '${parts[0]}' (x coordinate).`)
    }
    if (Number.isNaN(y) || !Number.isFinite(y)) {
        throw new Error(`Property '${propertyName}' contains invalid number in '${tagName}' items: '${parts[1]}' (y coordinate).`)
    }
    // Check that the string representation matches exactly (prevents "42abc" from being accepted)
    if (x.toString() !== parts[0]) {
        throw new Error(`Property '${propertyName}' contains invalid number in '${tagName}' items: '${parts[0]}' (x coordinate contains non-numeric characters).`)
    }
    if (y.toString() !== parts[1]) {
        throw new Error(`Property '${propertyName}' contains invalid number in '${tagName}' items: '${parts[1]}' (y coordinate contains non-numeric characters).`)
    }
    return { x, y }
}

/**
 * Validates and converts an Expression property value to a non-negative integer.
 * Throws an error if the value cannot be parsed as a non-negative integer.
 */
export const validateExpressionAsNonNegativeInteger = (value: string, propertyName: string, tagName: string): number => {
    const trimmed = value.trim()
    if (!trimmed) {
        throw new Error(`Property '${propertyName}' must be a non-negative integer in '${tagName}' items, but received empty value.`)
    }
    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
        throw new Error(`Property '${propertyName}' must be a non-negative integer in '${tagName}' items, but received '${value}'.`)
    }
    if (parsed < 0) {
        throw new Error(`Property '${propertyName}' must be a non-negative integer in '${tagName}' items, but received '${value}' (must be >= 0).`)
    }
    // Check that the string representation matches exactly (prevents "42abc" from being accepted)
    if (parsed.toString() !== trimmed) {
        throw new Error(`Property '${propertyName}' must be a non-negative integer in '${tagName}' items, but received '${value}' (contains non-numeric characters).`)
    }
    return parsed
}

export const validateProperties = <V extends ValidationTemplate>(template: V) => (parse: ParseTagOpen | ParseTagSelfClosure): ValidationTemplateOutput<V> => {
    const unmatchedKey = parse.properties.find(({ key }) => (!((key ?? 'DEFAULT') in template)))
    if (unmatchedKey) {
        throw new Error(`Property '${unmatchedKey.key}' is not allowed in '${parse.tag}' items.`)
    }
    const remap = Object.assign({}, ...Object.entries(template).map(([key, { required, type }]) => {
        const matchedKey = parse.properties.find(({ key: checkKey }) => ((checkKey || 'DEFAULT') === key))
        if (required && !matchedKey) {
            throw new Error(`Property '${key}' is required in '${parse.tag}' items.`)
        }

        if (type === ParsePropertyTypes.AssetList) {
            if (matchedKey && matchedKey.type === ParsePropertyTypes.AssetList) {
                return { [key]: matchedKey.value }
            } else if (matchedKey && matchedKey.type === ParsePropertyTypes.Asset) {
                return { [key]: [matchedKey.value] }
            } else if (matchedKey && matchedKey.type === ParsePropertyTypes.Key) {
                if (!isSchemaAssetUUID(matchedKey.value)) {
                    throw new Error(`Property '${key}' must be of AssetList type in '${parse.tag}' items.`)
                }
                return { [key]: [matchedKey.value] }
            }
        }

        if (matchedKey && (matchedKey.type !== type &&!(type === ParsePropertyTypes.Asset && matchedKey.type === ParsePropertyTypes.Key))) {
            const typeLabel = type === ParsePropertyTypes.Boolean ? 'Boolean' : 
                             type === ParsePropertyTypes.Expression ? 'Expression' : 
                             type === ParsePropertyTypes.Literal ? 'Literal' : 
                             type === ParsePropertyTypes.AssetList ? 'AssetList' :
                             type === ParsePropertyTypes.Asset ? 'Asset' : 'Key'
            throw new Error(`Property '${key}' must be of ${typeLabel} type in '${parse.tag}' items.`)
        }
        
        if (matchedKey) {
            return { [key]: matchedKey.value }
        }
        else {
            return {}
        }
    })) as ValidationTemplateOutput<V>
    return remap
}

export const validateContents = ({ isValid, branchTags, leafTags }: ConverterMapValidateProperties) => (contents: GenericTree<SchemaTag>): boolean => {
    return contents.reduce<boolean>((previous, { data: childTag, children }) => {
        if (!previous) {
            return previous
        }
        if (leafTags.includes(childTag.tag)) {
            return isValid(childTag)
        }
        else if (branchTags.includes(childTag.tag)) {
            if (!isValid(childTag)) {
                return false
            }
            else if (children.length) {
                return validateContents({ isValid, branchTags, leafTags })(children)
            }
        }
        return true
    }, true)
}

export const optionsFactory: PrintMapOptionsFactory = (action) => (previous) => {
    switch(action) {
        case PrintMapOptionsChange.Sibling:
            return previous
        case PrintMapOptionsChange.Indent:
            return {
                ...previous,
                indent: previous.indent + 1
            }
    }
    return previous
}
