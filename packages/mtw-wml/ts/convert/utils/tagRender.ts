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

export const tagRender = ({ schemaToWML, indent, forceNest, tag, properties, contents }: { schemaToWML: (value: SchemaTag, options: SchemaToWMLOptions) => string; indent: number, forceNest?: boolean, tag: string, properties: TagRenderProperty[]; contents: (string | SchemaTag)[]; }): string => {
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
    const { returnValue: mappedContents } = contents.reduce<{ returnValue: string[]; taggedMessageStack: SchemaTaggedMessageLegalContents[] }>((previous, tag, index) => {
        if (typeof tag === 'string') {
            return {
                returnValue: [
                    ...previous.returnValue,
                    ...(previous.taggedMessageStack.length ? [schemaDescriptionToWML(schemaToWML)(previous.taggedMessageStack, { indent: indent + 1, forceNest, padding: 0 })] : []),
                    tag
                ],
                taggedMessageStack: []
            }
        }
        if (isSchemaTaggedMessageLegalContents(tag)) {
            if (index === contents.length - 1) {
                return {
                    returnValue: [
                        ...previous.returnValue,
                        schemaDescriptionToWML(schemaToWML)([ ...previous.taggedMessageStack, tag ], { indent: indent + 1, forceNest, padding: 0 })
                    ],
                    taggedMessageStack: []
                }
            }
            else {
                return {
                    returnValue: previous.returnValue,
                    taggedMessageStack: [ ...previous.taggedMessageStack, tag ]
                }
            }
        }
        else {
            return {
                returnValue: [
                    ...previous.returnValue,
                    ...(previous.taggedMessageStack.length ? [schemaDescriptionToWML(schemaToWML)(previous.taggedMessageStack, { indent: indent + 1, forceNest, padding: 0 })] : []),
                    schemaToWML(tag, { indent: indent + 1, forceNest })
                ],
                taggedMessageStack: []
            }
        }
    }, { returnValue: [], taggedMessageStack: [] })
    const naive = `${tagOpen}${mappedContents.join('')}${tagClose}`
    const nested = `${[tagOpen, ...mappedContents].join(`\n${indentSpacing(indent + 1)}`)}\n${indentSpacing(indent)}${tagClose}`
    if (typeof forceNest === 'undefined') {
        return (naive.length > lineLengthAfterIndent(indent)) ? nested : naive
    }
    else {
        return forceNest ? nested : naive
    }
}
