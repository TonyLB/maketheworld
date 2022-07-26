import { ParseStackTagOpenEntry, ParseError, ParseTag } from "./baseClasses"

type ValidatePropertiesValueType = 'boolean' | 'key' | 'expression' | 'literal'

type ValidatePropertiesItem = Record<string, ValidatePropertiesValueType[]>

type ValidatePropertiesProps = {
    open: ParseStackTagOpenEntry;
    required: ValidatePropertiesItem;
    optional?: ValidatePropertiesItem;
}

export const validateProperties = <T extends Record<string, string | boolean>>({ open, required, optional = {} }: ValidatePropertiesProps): T | ParseError => {
    const illegalEntry = Object.entries(open.properties).reduce<ParseError | undefined>((previous, [key, value]) => {
        if (previous) {
            return previous
        }
        if (!(key in required || key in optional)) {
            return {
                tag: 'Error',
                message: `'${key}' is not a legal property on ${open.tag} tag`
            }
        }
        const valueType = typeof value === 'boolean'
            ? 'boolean'
            : value.type === 'ExpressionValue'
                ? 'expression'
                : value.type === 'KeyValue'
                    ? 'key'
                    : 'literal'

        const legalTypes = required[key] || optional[key]
        if (!legalTypes.includes(valueType)) {
            return {
                tag: 'Error',
                message: `'${key}' property cannot be of type: ${valueType}`
            }
        }
    }, undefined)
    if (illegalEntry) {
        return illegalEntry
    }
    const missingEntry = Object.keys(required).find((key) => (!(key in open.properties)))
    if (missingEntry) {
        return {
            tag: 'Error',
            message: `'${missingEntry}' property is required on ${open.tag} tag`
        }
    }
    return Object.entries(open.properties)
        .map(([key, value]) => {
            if (typeof value === 'boolean') {
                return [key, value]
            }
            else {
                return [key, value.value]
            }
        })
        .reduce<Record<string, string | boolean>>((previous, [key, value]: [string, string | boolean]) => ({ ...previous, [key]: value }), {}) as T
}

export const isValidateError = (value: Record<string, string | boolean> | ParseError): value is ParseError => (value.tag === 'Error')

export type ExtractProperties<T extends ParseTag, omit extends string> = Omit<T, 'tag' | 'contents' | 'startTagToken' | 'endTagToken' | 'startContentsToken' | 'endContentsToken' | 'closeToken' | omit>
