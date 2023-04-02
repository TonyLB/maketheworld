import { lineLengthAfterIndent, indentSpacing } from "./index"
import { isSchemaTaggedMessageLegalContents, SchemaTag, SchemaTaggedMessageLegalContents } from "../../schema/baseClasses";
import { schemaDescriptionToWML } from "../description";
import { BaseConverter, SchemaToWMLOptions } from "../functionMixins";
import { isLegalParseConditionContextTag } from "../../parser/baseClasses";
import { escapeWMLCharacters } from "../../lib/escapeWMLCharacters";

type TagRenderProperty = {
    key?: string;
    type: 'key' | 'expression' | 'literal';
    value: string;
} | {
    key: string;
    type: 'boolean';
    value: boolean;
}

const extractConditionContextTag = (context: SchemaTag[]): SchemaTag["tag"] => {
    const contextTagRaw = context.reduce<SchemaTag["tag"]>((previous, item) => {
        const tag = item.tag
        if (isLegalParseConditionContextTag(tag)) {
            return tag
        }
        return previous
    }, undefined)
    return contextTagRaw === 'Bookmark' ? 'Description' : contextTagRaw
}

export const tagRender = ({ schemaToWML, indent, forceNest, context, tag, properties, contents }: { schemaToWML: (value: SchemaTag, options: SchemaToWMLOptions) => string; indent: number, forceNest?: 'closed' | 'contents' | 'properties', tag: string, context: SchemaTag[], properties: TagRenderProperty[]; contents: (string | SchemaTag)[]; }): string => {
    const descriptionContext = ["Description", "Name", "FirstImpression", "OneCoolThing", "Outfit"].includes(extractConditionContextTag(context))
    const propertyRender = properties.map((property) => {
        const propertyKeyLead = `${property.key ? `${escapeWMLCharacters(property.key)}=` : '' }`
        switch(property.type) {
            case 'boolean':
                return property.value ? `${escapeWMLCharacters(property.key)}` : ''
            case 'expression':
                return property.value ? `${propertyKeyLead}{${escapeWMLCharacters(property.value)}}` : ''
            case 'key':
                return property.value ? `${propertyKeyLead}(${escapeWMLCharacters(property.value)})` : ''
            case 'literal':
                return property.value ? `${propertyKeyLead}"${escapeWMLCharacters(property.value)}"` : ''
        }
    }).filter((value) => (value))

    const { returnValue: mappedContents } = contents.reduce<{ returnValue: string[]; siblings: SchemaTag[]; taggedMessageStack: SchemaTaggedMessageLegalContents[] }>((previous, tag, index) => {
        if (typeof tag === 'string') {
            return {
                returnValue: [
                    ...previous.returnValue,
                    ...(previous.taggedMessageStack.length ? [schemaDescriptionToWML(schemaToWML)(previous.taggedMessageStack, { indent: indent + 1, forceNest, padding: 0, context, siblings: previous.siblings })] : []),
                    tag
                ],
                siblings: previous.siblings,
                taggedMessageStack: []
            }
        }
        if (descriptionContext && isSchemaTaggedMessageLegalContents(tag)) {
            if (index === contents.length - 1) {
                return {
                    returnValue: [
                        ...previous.returnValue,
                        schemaDescriptionToWML(schemaToWML)([ ...previous.taggedMessageStack, tag ], { indent: indent + 1, forceNest, context, padding: 0, siblings: previous.siblings })
                    ],
                    siblings: [ ...previous.siblings, tag],
                    taggedMessageStack: []
                }
            }
            else {
                return {
                    returnValue: previous.returnValue,
                    siblings: [ ...previous.siblings, tag],
                    taggedMessageStack: [ ...previous.taggedMessageStack, tag ]
                }
            }
        }
        else {
            return {
                returnValue: [
                    ...previous.returnValue,
                    ...(previous.taggedMessageStack.length ? [schemaDescriptionToWML(schemaToWML)(previous.taggedMessageStack, { indent: indent + 1, forceNest, context, padding: 0, siblings: previous.siblings })] : []),
                    schemaToWML(tag, { indent: indent + 1, forceNest, siblings: previous.siblings, context })
                ],
                siblings: [ ...previous.siblings, tag],
                taggedMessageStack: []
            }
        }
    }, { returnValue: [], siblings: [], taggedMessageStack: [] })
    const tagOpen = mappedContents.length ? `<${[tag, ...propertyRender].join(' ')}>` : `<${[tag, ...propertyRender].join(' ')} />`
    const nestedTagOpen = mappedContents.length ? `<${[tag, ...propertyRender].join(`\n${indentSpacing(indent + 1)}`)}\n${indentSpacing(indent)}>` : `<${[tag, ...propertyRender].join(`\n${indentSpacing(indent + 1)}`)}\n${indentSpacing(indent)}/>`
    const tagClose = mappedContents.length ? `</${tag}>` : ''
    const naive = `${tagOpen}${mappedContents.join('')}${tagClose}`
    const nested = mappedContents.length ? `${[tagOpen, ...mappedContents].join(`\n${indentSpacing(indent + 1)}`)}\n${indentSpacing(indent)}${tagClose}` : naive
    const propertyNested = mappedContents.length ? `${[nestedTagOpen, ...mappedContents].join(`\n${indentSpacing(indent + 1)}`)}\n${indentSpacing(indent)}${tagClose}` : nestedTagOpen
    switch(forceNest) {
        case 'closed': return naive
        case 'contents':
            return nested
        case 'properties':
            return propertyNested
        default:
            return (naive.length <= lineLengthAfterIndent(indent))
                ? naive
                : (nested.split('\n')[0] || '').length <= lineLengthAfterIndent(indent)
                    ? nested
                    : propertyNested
    }
}
