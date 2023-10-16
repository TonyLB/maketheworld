import { SchemaAssetTag, SchemaTag, isSchemaTag } from "../schema/baseClasses"
import { ParsePropertyTypes, ParseTagOpen, ParseTagSelfClosure } from "../simpleParser/baseClasses"

export type SchemaConverterArguments = {
    parseOpen: ParseTagOpen | ParseTagSelfClosure;
}

export type SchemaInitialConverter = {
    (args: SchemaConverterArguments): SchemaTag
}

const getParseKey = (parse: ParseTagOpen | ParseTagSelfClosure, key: string, enforceType?: ParsePropertyTypes): string | boolean | undefined => {
    const keyItem = parse.properties.find((item) => (key === item.key))
    if (typeof enforceType !== 'undefined') {
        if (keyItem && keyItem.type !== enforceType) {
            throw new Error(`Property '${key} must be of type ${enforceType === ParsePropertyTypes.Key ? 'Key' : enforceType === ParsePropertyTypes.Expression ? 'Expression' : enforceType === ParsePropertyTypes.Literal ? 'Literal' : 'Boolean'}`)
        }
    }
    return keyItem?.value
}

//
// TODO: Create *validatedProperties* parser that uses Typescript meta-programming to convert
// a record with keys to values like { required: true, type: 'boolean' } into a record
// with the type constrained structure for those keys.
//
type ValidationTemplateItem = {
    required?: boolean;
    type: ParsePropertyTypes;
}

type ValidationTemplate = Record<string, ValidationTemplateItem>

type ValidationTemplateRemap<V extends ValidationTemplate>  ={
    [K in keyof V]: V[K] extends { type: ParsePropertyTypes.Boolean } ? boolean : string
}

type ValidationRequiredKeys<V extends ValidationTemplate> = {[K in keyof V]: V[K] extends { required: true } ? K : never}[keyof V]

type ValidationTemplateOutput<V extends ValidationTemplate> = 
    Partial<ValidationTemplateRemap<V>> &
    Pick<ValidationTemplateRemap<V>, ValidationRequiredKeys<V>>

const validateProperties = <V extends ValidationTemplate>(template: V) => (parse: ParseTagOpen | ParseTagSelfClosure): ValidationTemplateOutput<V> => {
    const remap = Object.assign({}, ...Object.entries(template).map(([key, { required, type }]) => {
        if (required && !(key in parse.properties)) {
            throw new Error(`Property '${key}' is required in '${parse.tag}' items.`)
        }
        if (key in parse.properties && parse.properties[key].type !== type) {
            const typeLabel = type === ParsePropertyTypes.Boolean ? 'Boolean' : type === ParsePropertyTypes.Expression ? 'Expression' : type === ParsePropertyTypes.Literal ? 'Literal' : 'Key'
            throw new Error(`Property '${key}' must be of ${typeLabel} type in '${parse.tag}' items.`)
        }
        if (key in parse.properties) {
            return { [key]: parse.properties[key].value }
        }
        else {
            return {}
        }
    })) as ValidationTemplateOutput<V>
    return remap
}

const validationTemplates = {
    Asset: {
        key: { required: true, type: ParsePropertyTypes.Key }
    }
} as const

export const converterMap: Record<string, { initialize: SchemaInitialConverter; }> = {
    Asset: {
        initialize: ({ parseOpen }): SchemaAssetTag => {
            return {
                tag: 'Asset',
                contents: [],
                Story: undefined,
                ...validateProperties(validationTemplates.Asset)(parseOpen)
            }
        }
    }
}

export default converterMap
