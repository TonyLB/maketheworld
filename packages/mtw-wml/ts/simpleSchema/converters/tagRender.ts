import { isSchemaTaggedMessageLegalContents, SchemaTag, SchemaTaggedMessageLegalContents } from "../../schema/baseClasses"
import { isLegalParseConditionContextTag } from "../../parser/baseClasses"
import { escapeWMLCharacters } from "../../lib/escapeWMLCharacters"
import { PrintMapEntryArguments, PrintMapOptionsChange } from "./baseClasses"
import { indentSpacing, lineLengthAfterIndent } from "./printUtils"
import { schemaDescriptionToWML } from "./prettyPrint/freeText"
import { optionsFactory } from "./utils"

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

//
// tagRender evaluates the various ways that a tag can be rendered, and compares their suitability against current space available before forced word-wrap.
// The types of render evaluated are:
//    - Naive: Render everything from the start of the tag to its close on a single line
//    - Nested: Render the opening tag and closing tags on single lines, and nest contents between them
//    - Property-Nested: Render the opening tag with each property nested inside it on an individual line, the closing tag on a single line, and
//      nest contents between them.
//
export const tagRender = ({ schemaToWML, options, tag, properties, contents }: Omit<PrintMapEntryArguments, 'tag'> & { tag: string, properties: TagRenderProperty[]; contents: (string | SchemaTag)[]; }): string => {
    //
    // TODO: Further document the control flow of the function.
    //
    const { indent, forceNest, context } = options
    const descriptionContext = ["Description", "Name", "FirstImpression", "OneCoolThing", "Outfit"].includes(extractConditionContextTag(context))
    //
    // Individual properties can be rendered before knowing how they will be sorted (and kept in a list).
    //
    const propertyRender = properties.map((property) => {
        const propertyKeyLead = property.key ? `${escapeWMLCharacters(property.key)}=` : ''
        switch(property.type) {
            case 'boolean':
                return property.value ? `${escapeWMLCharacters(property.key)}` : ''
            case 'expression':
                return property.value ? `${propertyKeyLead}{${property.value}}` : ''
            case 'key':
                return property.value ? `${propertyKeyLead}(${escapeWMLCharacters(property.value)})` : ''
            case 'literal':
                return property.value ? `${propertyKeyLead}"${escapeWMLCharacters(property.value)}"` : ''
        }
    }).filter((value) => (value))

    //
    // Parse sequentially through the contents, mapping strings/Tags to renderings of their value.
    //
    const { returnValue: mappedContents } = contents.reduce<{ returnValue: string[]; siblings: SchemaTag[]; taggedMessageStack: SchemaTaggedMessageLegalContents[] }>((previous, tag, index) => {
        //
        // TODO: Explain why a tag would ever be a string, and how it's handled.
        //
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
        //
        // Branch 2: Free text in a legal context should be parsed using schemaDescriptionToWML (which includes the more-sophisticated
        // word-wrap functionality that can break strings across lines as needed)
        //
        if (descriptionContext && isSchemaTaggedMessageLegalContents(tag)) {
            //
            // Branch 2.1: You are at the end of the description, so take all previous tags, as well as this tag, and run the whole list
            // through schemaDescriptionToWML using an added indent.
            //
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
            //
            // Branch 2.2: There are more tags to consider after this one ... throw this onto the taggedMessage stack and proceed.
            //
            else {
                return {
                    returnValue: previous.returnValue,
                    siblings: [ ...previous.siblings, tag],
                    taggedMessageStack: [ ...previous.taggedMessageStack, tag ]
                }
            }
        }
        //
        // Branch 3: Non-free-text tags need to be handled by an algorithm that doesn't worry about word-wrap... but also must be conscious that
        // the tag may be rendered *right after* a long free-text section.  Render free-text if there is any on the taggedMessage stack,
        // then render the tag with a recursive call to the passed schemaToWML callback function.
        //
        else {
            const newOptions = optionsFactory(PrintMapOptionsChange.Indent)({ ...options, siblings: previous.siblings, context: [...options.context, tag] })
            return {
                returnValue: [
                    ...previous.returnValue,
                    ...(previous.taggedMessageStack.length ? [schemaDescriptionToWML(schemaToWML)(previous.taggedMessageStack, { ...newOptions, padding: 0 })] : []),
                    schemaToWML({ tag, options: newOptions, schemaToWML, optionsFactory })
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
