import { lineLengthAfterIndent, indentSpacing } from "."
import { SchemaTag } from "../../schema/baseClasses";

type TagRenderProperty = {
    key: string;
    type: 'key' | 'expression' | 'literal';
    value: string;
} | {
    key: string;
    type: 'boolean';
    value: boolean;
}

export const tagRender = ({ schemaToWML, indent, forceNest, tag, properties, contents }: { schemaToWML: (value: SchemaTag) => string; indent: number, forceNest?: boolean, tag: string, properties: TagRenderProperty[]; contents: string[]; }): string => {
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
    const naive = `${tagOpen}${contents.join('')}${tagClose}`
    const nested = `${[tagOpen, ...contents].join(`\n${indentSpacing(indent + 1)}`)}\n${indentSpacing(indent)}${tagClose}`
    if (typeof forceNest === 'undefined') {
        return (naive.length > lineLengthAfterIndent(indent)) ? nested : naive
    }
    else {
        return forceNest ? nested : naive
    }
}
