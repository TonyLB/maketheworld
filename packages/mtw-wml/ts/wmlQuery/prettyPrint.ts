import { isParseTagNesting, ParseException, ParseTag } from "../parser/baseClasses"
import { Token, TokenProperty, TokenTagOpenBegin, TokenTagOpenEnd, TokenValue } from "../parser/tokenizer/baseClasses";
import { SchemaTag } from "../schema/baseClasses";

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

type ExtractTagOpenResult = {
    tagOpenBegin: TokenTagOpenBegin;
    properties: {
        key: TokenProperty;
        value?: TokenValue;
    }[];
    tagOpenEnd: TokenTagOpenEnd;
}

const extractTagOpen = (items: Token[]): ExtractTagOpenResult => {
    if (items.length === 0) {
        throw new ParseException('Empty subitem in prettyPrint', 0, 0)
    }
    const tagOpenBegin = items[0]
    if (tagOpenBegin.type !== 'TagOpenBegin') {
        throw new ParseException('Illegal tag open in prettyPrint', 0, 0)
    }
    let indexOfTagOpenEnd = 1
    while(indexOfTagOpenEnd < items.length - 1 && items[indexOfTagOpenEnd].type !== 'TagOpenEnd') {
        indexOfTagOpenEnd++
    }
    const tagOpenEnd = items[indexOfTagOpenEnd]
    if (tagOpenEnd.type !== 'TagOpenEnd') {
        throw new ParseException('No tag-open closure found in prettyPrint', 0, 0)
    }
    return {
        tagOpenBegin,
        tagOpenEnd,
        properties: []
    }
}

const prettyPrintEvaluate = ({ source, tokens }: { source: string; tokens: Token[] }) => ({ node, mode = PrettyPrintEvaluations.Unevaluated, indent = 0 }: { node: ParseTag; mode?: PrettyPrintEvaluations; indent?: number }): ParsePrettyPrintEvaluation => {
    if (isParseTagNesting(node)) {

    }
    else {

    }
    const { startIdx } = tokens[node.startTagToken]
    const { endIdx } = tokens[node.endTagToken]
    return {
        tag: node,
        evaluation:PrettyPrintEvaluations.NoNesting,
        cached: source.slice(startIdx, endIdx + 1)
    }
}

export const prettyPrint = ({ tokens, schema, source }: { tokens: Token[]; schema: SchemaTag[]; source: string }): string => {
    const evaluator = prettyPrintEvaluate({ tokens, source })
    return schema.map(({ parse }) => (evaluator({ node: parse }))).map(({ cached }) => (cached)).join('')
}

export default prettyPrint
