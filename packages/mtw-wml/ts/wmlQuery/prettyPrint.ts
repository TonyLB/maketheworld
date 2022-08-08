import { isParseTagNesting, ParseException, ParseTag } from "../parser/baseClasses"
import { isTokenProperty, isTokenValue, isTokenWhitespace, Token, TokenProperty, TokenTagOpenBegin, TokenTagOpenEnd, TokenValue } from "../parser/tokenizer/baseClasses"
import { SchemaTag } from "../schema/baseClasses"
import { zipList } from "../list"

enum PrettyPrintEvaluations {
    Unevaluated,
    NoNesting,
    HasTagsToInheritNesting,
    MustNest
}

type ParsePrettyPrintEvaluation = {
    tag: ParseTag;
    evaluation: PrettyPrintEvaluations;
    cached?: string;
}

const selfClosingTags: ParseTag["tag"][] = ['Pronouns', 'Image', 'Use', 'Depend', 'Variable', 'Computed', 'Action', 'Exit', 'Room', 'Feature']
const mustIndentContents: ParseTag["tag"][] = ['Asset', 'Story', 'Room', 'Feature', 'Import']

const trimWhitespaceEnds = (items: ParseTag[]): ParseTag[] => {
    let start = 0
    while(start < items.length && items[start].tag === 'Whitespace') {
        start++
    }
    let end = items.length - 1
    while(end > 0 && items[end].tag === 'Whitespace') {
        end--
    }
    if (end < start) {
        start = end
    }
    return items.slice(start, end + 1)
}

type PrettyPrintProperty = {
    key: TokenProperty;
    value?: TokenValue;
}

type ExtractTagOpenResult = {
    tagOpenBegin: TokenTagOpenBegin;
    properties: PrettyPrintProperty[];
    tagOpenEnd: TokenTagOpenEnd;
}

const extractTagOpen = (items: Token[]): ExtractTagOpenResult => {
    if (items.length === 0) {
        throw new ParseException('Empty subitem in prettyPrint', 0, 0)
    }
    const tagOpenBegin = items[0]
    if (tagOpenBegin.type !== 'TagOpenBegin') {
        throw new ParseException(`Illegal tag open in prettyPrint (${tagOpenBegin.type})`, 0, 0)
    }
    let indexOfTagOpenEnd = 1
    while(indexOfTagOpenEnd < items.length - 1 && items[indexOfTagOpenEnd].type !== 'TagOpenEnd') {
        indexOfTagOpenEnd++
    }
    const tagOpenEnd = items[indexOfTagOpenEnd]
    if (tagOpenEnd.type !== 'TagOpenEnd') {
        throw new ParseException('No tag-open closure found in prettyPrint', 0, 0)
    }
    const properties = zipList(
        items
            .slice(1, indexOfTagOpenEnd)
            .filter((item) => (!isTokenWhitespace(item))),
        ({ first, second }) => {
            if (first && isTokenProperty(first)) {
                if (first.isBoolean) {
                    return {
                        key: first
                    }
                }
                else if (second && isTokenValue(second)) {
                    return {
                        key: first,
                        value: second
                    }
                }
                return undefined
            }
        }
    ).filter((value) => (value))
        
    return {
        tagOpenBegin,
        tagOpenEnd,
        properties
    }
}

const prettyPrintTagOpen = ({ tagOpenBegin, properties, tagOpenEnd }: { tagOpenBegin: TokenTagOpenBegin; properties: PrettyPrintProperty[]; tagOpenEnd: TokenTagOpenEnd }, mode: PrettyPrintEvaluations, selfClosing: boolean): string => {
    const propertyStrings = properties.map(({ key, value }) => {
        if (value) {
            switch(value.type) {
                case 'ExpressionValue':
                    return `${key.key}={${value.value}}`
                case 'KeyValue':
                    return `${key.key}=(${value.value})`
                case 'LiteralValue':
                    return `${key.key}="${value.value}"`
            }
        }
        else {
            return key.key
        }
    })
    //
    // TODO: Create alternate nested render depending upon the mode passed
    //
    return `<${tagOpenBegin.tag}${['', ...propertyStrings].join(' ')}${ selfClosing ? ' />' : '>'}`
}

const prettyPrintIndent = (n: number) => (src: string) => (
    src.split('\n').map((value) => (`${'    '.repeat(n)}${value}`)).join('\n')
)

const prettyPrintEvaluate = ({ source, tokens }: { source: string; tokens: Token[] }) => ({ node, mode = PrettyPrintEvaluations.Unevaluated, indent = 0 }: { node: ParseTag; mode?: PrettyPrintEvaluations; indent?: number }): ParsePrettyPrintEvaluation => {
    if (node.tag === 'String') {
        return {
            tag: node,
            evaluation: PrettyPrintEvaluations.NoNesting,
            cached: node.value
        }
    }
    if (node.tag === 'Whitespace') {
        return {
            tag: node,
            evaluation: PrettyPrintEvaluations.NoNesting,
            cached: ''
        }
    }
    const tagOpenResults = extractTagOpen(tokens.slice(node.startTagToken, node.endTagToken + 1).filter((token) => (!isTokenWhitespace(token))))
    if (isParseTagNesting(node)) {
        const selfClosing = node.contents.length === 0
        const tagOpenSrc = prettyPrintTagOpen(tagOpenResults, PrettyPrintEvaluations.NoNesting, selfClosing)
        //
        // If self-closing tag, ignore possibility of contents
        //
        if (selfClosing) {
            return {
                tag: node,
                evaluation: PrettyPrintEvaluations.NoNesting,
                cached: tagOpenSrc
            }
        }
        //
        // If contents exist, evaluate them for prettyPrint and then assemble the parent tag accordingly
        //
        else {
            const contents = node.contents.map((item) => (prettyPrintEvaluate({ source, tokens })({ node: item, indent })))
            //
            // If one of the subordinate nodes must nest, or if it is a tag of its own, then nest all.
            //
            // TODO: Refactor so that Description tags have much more capable pretty-printing capabilities
            //
            if (node.tag === 'Description' || contents.find(({ evaluation }) => ([PrettyPrintEvaluations.MustNest, PrettyPrintEvaluations.HasTagsToInheritNesting].includes(evaluation)))) {
                const contentsSource = contents.map(({ cached }) => (cached)).filter((value) => (value)).join('\n')
                return {
                    tag: node,
                    evaluation: PrettyPrintEvaluations.HasTagsToInheritNesting,
                    cached: `${tagOpenSrc}\n${prettyPrintIndent(1)(contentsSource)}\n</${node.tag}>`
                }
            }
            //
            // Otherwise, print on a single line.
            //
            // TODO: Evaluate whether item should be forced to nest because of line length
            //
            else {
                const contentsSource = contents.map(({ cached }) => (cached)).join('')
                return {
                    tag: node,
                    evaluation: PrettyPrintEvaluations.HasTagsToInheritNesting,
                    cached: `${tagOpenSrc}${contentsSource}</${node.tag}>`
                }
            }
        }
    }
    else {
        return {
            tag: node,
            evaluation: PrettyPrintEvaluations.NoNesting,
            cached: prettyPrintTagOpen(tagOpenResults, PrettyPrintEvaluations.NoNesting, true)
        } 
    }
}

export const prettyPrint = ({ tokens, schema, source }: { tokens: Token[]; schema: SchemaTag[]; source: string }): string => {
    const evaluator = prettyPrintEvaluate({ tokens, source })
    return schema.map(({ parse }) => (evaluator({ node: parse }))).map(({ cached }) => (cached)).join('')
}

export default prettyPrint
