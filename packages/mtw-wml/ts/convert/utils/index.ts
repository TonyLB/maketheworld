import { ParseStackTagOpenEntry, ParseTag, ParseException } from "../../parser/baseClasses"
import { parse as acornParse} from "acorn"
import { simple as simpleWalk } from "acorn-walk"
import { SchemaTag } from "../../schema/baseClasses"

type ValidatePropertiesValueType = 'boolean' | 'key' | 'expression' | 'literal'

export type ValidatePropertiesItem = Record<string, ValidatePropertiesValueType[]>

type ValidatePropertiesProps = {
    open: ParseStackTagOpenEntry;
    endTagToken: number;
    required: ValidatePropertiesItem;
    optional?: ValidatePropertiesItem;
}

//
// Given a TagOpen token, validateProperties checks against a known set of required and optional properties,
// to syntax check the tokens being parsed.
//
export const validateProperties = <T extends Record<string, any>>({ open, required, endTagToken, optional = {} }: ValidatePropertiesProps): ForceStringType<T> => {
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
        .reduce<Record<string, any>>((previous, [key, value]: [string, any]) => ({ ...previous, [key]: value }), {}) as ForceStringType<T>
}

export type ExtractProperties<T extends ParseTag, omit extends string> = Omit<T, 'tag' | 'contents' | 'startTagToken' | 'endTagToken' | omit>

export type ForceStringType<T extends Object> = {
    [K in keyof T]: T[K] extends boolean ? boolean : string;
}

type ValidateContentsProps<T extends ParseTag> = {
    contents: ParseTag[];
    legalTags: T["tag"][];
    ignoreTags: ParseTag["tag"][];
}

//
// Given a TagOpen that (at least potentially) has contents, validateContents will confirm that only legal
// child-types are represented in the first level of the content tree.  It will also filter out any tags that
// are passed as needing to be ignored.
//
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

//
// extractDependenciesFromJS is a painfully naive dependency extractor using only the barest fraction of the recursive
// scoping functionality of acorn-walk ... and will still probably be good enough for 99+% of cases
//
export const extractDependenciesFromJS = (src: string): string[] => {
    const parsedJS = acornParse(src.trim(), { ecmaVersion: 'latest' })
    let identifiedGlobals: string[] = []
    let definedLocals: string[] = []
    simpleWalk(parsedJS, {
        Identifier(node) {
            const identifier = (node as any).name
            if (!(definedLocals.includes(identifier))) {
                identifiedGlobals.push(identifier)
            }
        },
        ArrowFunctionExpression(node) {
            ((node as any).params || []).forEach(({ name }) => {
                definedLocals.push(name)
            })
        },
        VariableDeclarator(node) {
            definedLocals.push((node as any).id.name)
        }
    })
    return [...(new Set(identifiedGlobals.filter((item) => (!definedLocals.includes(item)))))]
}

export const indentSpacing = (indent: number): string => {
    return '    '.repeat(indent)
}

export const lineLengthAfterIndent = (indent: number): number => (Math.max(40, 80 - indent * 4))

type TagRenderProperty = {
    key: string;
    type: 'key' | 'expression' | 'literal';
    value: string;
} | {
    key: string;
    type: 'boolean';
    value: boolean;
}

export const tagRender = ({ indent, forceNest, tag, properties, contents }: { indent: number, forceNest?: boolean, tag: string, properties: TagRenderProperty[]; contents: string[]; }): string => {
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
