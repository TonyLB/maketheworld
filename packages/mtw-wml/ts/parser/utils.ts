import { ParseStackTagOpenEntry, ParseTag, ParseException } from "./baseClasses"

type ValidatePropertiesValueType = 'boolean' | 'key' | 'expression' | 'literal'

type ValidatePropertiesItem = Record<string, ValidatePropertiesValueType[]>

type ValidatePropertiesProps = {
    open: ParseStackTagOpenEntry;
    endTagToken: number;
    required: ValidatePropertiesItem;
    optional?: ValidatePropertiesItem;
}

export const validateProperties = <T extends Record<string, any>>({ open, required, endTagToken, optional = {} }: ValidatePropertiesProps): T => {
    Object.entries(open.properties).forEach(([key, value]) => {
        if (!(key in required || key in optional)) {
            throw new ParseException(`'${key}' is not a legal property on ${open.tag} tag`, open.startTagToken, endTagToken)
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
            throw new ParseException(`'${key}' property cannot be of type: ${valueType}`, open.startTagToken, endTagToken)
        }
    })
    const missingEntry = Object.keys(required).find((key) => (!(key in open.properties)))
    if (missingEntry) {
        throw new ParseException(`'${missingEntry}' property is required on ${open.tag} tag`, open.startTagToken, endTagToken)
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
        .reduce<Record<string, any>>((previous, [key, value]: [string, any]) => ({ ...previous, [key]: value }), {}) as T
}

export type ExtractProperties<T extends ParseTag, omit extends string> = Omit<T, 'tag' | 'contents' | 'startTagToken' | 'endTagToken' | 'startContentsToken' | 'endContentsToken' | 'closeToken' | omit>

type ValidateContentsProps<T extends ParseTag> = {
    contents: ParseTag[];
    legalTags: T["tag"][];
    ignoreTags: ParseTag["tag"][];
}

export const validateContents = <T extends ParseTag>({ contents, legalTags, ignoreTags }: ValidateContentsProps<T>): T[] => {
    return contents.reduce<T[]>((previous, contentItem) => {
        if (legalTags.includes(contentItem.tag)) {
            return [...previous, contentItem as T]
        }
        if (!ignoreTags.includes(contentItem.tag)) {
            throw new ParseException(`'${contentItem.tag}' tag not allowed in this context`, contentItem.startTagToken, contentItem.endTagToken)
        }
        return previous
    }, [])
}
