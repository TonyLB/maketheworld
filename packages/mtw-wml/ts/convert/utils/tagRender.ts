import { lineLengthAfterIndent, indentSpacing } from "."
import { isSchemaTaggedMessageLegalContents, SchemaTag, SchemaTaggedMessageLegalContents } from "../../schema/baseClasses";
import { schemaDescriptionToWML } from "../description";
import { BaseConverter, SchemaToWMLOptions } from "../functionMixins";

type TagRenderProperty = {
    key: string;
    type: 'key' | 'expression' | 'literal';
    value: string;
} | {
    key: string;
    type: 'boolean';
    value: boolean;
}

export const tagRender = ({ schemaToWML, indent, forceNest, context, tag, properties, contents }: { schemaToWML: (value: SchemaTag, options: SchemaToWMLOptions) => string; indent: number, forceNest?: boolean, tag: string, context: SchemaTag[], properties: TagRenderProperty[]; contents: (string | SchemaTag)[]; }): string => {
    const propertyRender = properties.map((property) => {
        switch(property.type) {
            case 'boolean':
                return property.value ? `${property.key}` : ''
            case 'expression':
                return property.value ? `${property.key}={${property.value}}` : ''
            case 'key':
                return property.value ? `${property.key}=(${property.value})` : ''
            case 'literal':
                return property.value ? `${property.key}="${property.value}"` : ''
        }
    }).filter((value) => (value))
    const tagOpen = `<${[tag, ...propertyRender].join(' ')}>`
    const tagClose = `</${tag}>`
    //
    // TODO: Add taggedMessageSiblingBase to reduce returns, in order to keep the starting point of
    // sibling tags for schemaDescriptionToWML, and then use that to equip schemaDescriptionToWML with
    // sibling processing as well
    //
    const { returnValue: mappedContents } = contents.reduce<{ returnValue: string[]; siblings: SchemaTag[]; taggedMessageStack: SchemaTaggedMessageLegalContents[] }>((previous, tag, index) => {
        if (typeof tag === 'string') {
            return {
                returnValue: [
                    ...previous.returnValue,
                    ...(previous.taggedMessageStack.length ? [schemaDescriptionToWML(schemaToWML)(previous.taggedMessageStack, { indent: indent + 1, forceNest, padding: 0, context })] : []),
                    tag
                ],
                siblings: previous.siblings,
                taggedMessageStack: []
            }
        }
        if (isSchemaTaggedMessageLegalContents(tag)) {
            if (index === contents.length - 1) {
                return {
                    returnValue: [
                        ...previous.returnValue,
                        schemaDescriptionToWML(schemaToWML)([ ...previous.taggedMessageStack, tag ], { indent: indent + 1, forceNest, context, padding: 0 })
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
                    ...(previous.taggedMessageStack.length ? [schemaDescriptionToWML(schemaToWML)(previous.taggedMessageStack, { indent: indent + 1, forceNest, context, padding: 0 })] : []),
                    schemaToWML(tag, { indent: indent + 1, forceNest, siblings: previous.siblings, context })
                ],
                siblings: [ ...previous.siblings, tag],
                taggedMessageStack: []
            }
        }
    }, { returnValue: [], siblings: [], taggedMessageStack: [] })
    const naive = `${tagOpen}${mappedContents.join('')}${tagClose}`
    const nested = `${[tagOpen, ...mappedContents].join(`\n${indentSpacing(indent + 1)}`)}\n${indentSpacing(indent)}${tagClose}`
    if (typeof forceNest === 'undefined') {
        return (naive.length > lineLengthAfterIndent(indent)) ? nested : naive
    }
    else {
        return forceNest ? nested : naive
    }
}
