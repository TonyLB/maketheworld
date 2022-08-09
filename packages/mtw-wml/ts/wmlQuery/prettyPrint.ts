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

const prettyPrintIndent = (n: number) => (src: string) => (
    src.split('\n').map((value) => (`${'    '.repeat(n)}${value}`)).join('\n')
)

const measureIndentOfLine = (line: string): number => {
    let i = 0
    let returnValue = 0
    while(i<line.length) {
        if (line[i] === ' ') {
            returnValue++
        }
        else if (line[i] === '\t') {
            returnValue += 4
        }
        else {
            break
        }
        i++
    }
    return returnValue
}

const removeIndentFromLine = (indent: number) => (line: string): string => {
    const tabExpandedLine = line.replace(/\t/g, '    ')
    return tabExpandedLine.slice(indent)
}

const removeCommonIndent = (src: string): string => {
    const lines = src.split('\n')
    if (lines.length <= 1) {
        return src
    }
    //
    // Ignore first line in indent calculation, since it will be on the same line as its property, and
    // therefore will have entirely other indentation standards
    //
    const [firstLine, ...followingLines] = lines
    const filteredLines = followingLines.map((value) => {
        if (value.match(/^\s*$/)) {
            return ''
        }
        return value
    })
    const minIndent = filteredLines
        .filter((line) => (line))
        .reduce((previous, line) => (Math.min(previous, measureIndentOfLine(line))), Infinity)
    if (minIndent === Infinity) {
        return src
    }

    //
    // Remove all but one indent worth of common whitespace from the passed multi-line value
    //
    return [firstLine, ...filteredLines.map(removeIndentFromLine(Math.max(0, minIndent - 4)))].join('\n')
}

const prettyPrintTagOpen = ({
        tagOpen, mode, selfClosing, indent
    }: {
        tagOpen: { tagOpenBegin: TokenTagOpenBegin; properties: PrettyPrintProperty[]; tagOpenEnd: TokenTagOpenEnd },
        mode: PrettyPrintEvaluations,
        selfClosing: boolean,
        indent: number
    }): string => {
    const { tagOpenBegin, properties } = tagOpen
    const propertyStrings = properties.map(({ key, value }) => {
        if (value) {
            switch(value.type) {
                case 'ExpressionValue':
                    return `${key.key}={${removeCommonIndent(value.value)}}`
                case 'KeyValue':
                    return `${key.key}=(${removeCommonIndent(value.value)})`
                case 'LiteralValue':
                    return `${key.key}="${removeCommonIndent(value.value)}"`
            }
        }
        else {
            return key.key
        }
    })
    const maxLength = Math.max(80 - (indent * 4), 40)
    const testReturn = `<${tagOpenBegin.tag}${['', ...propertyStrings].join(' ')}${ selfClosing ? ' />' : '>'}`
    if (testReturn.length <= maxLength) {
        return testReturn
    }
    else {
        return `<${tagOpenBegin.tag}\n${prettyPrintIndent(1)(propertyStrings.join('\n'))}\n${ selfClosing ? '/>' : '>'}`
    }
}

const lastItem = <T>(list: T[]): { last: T, previous: T[] } => {
    return {
        last: list.length > 0 ? list.slice(-1)[0] : null,
        previous: list.slice(0, -1)
    }
}

function * descriptionWrap ({ source, tokens, contents, indent }: { source: string; tokens: Token[]; contents: ParseTag[], indent: number }): Generator<string> {
    let bufferFlat: string = ''
    let bufferNested: string = ''
    let displayingTagsNested: boolean = false
    let trailingTokens: boolean = false
    let whiteSpaceBuffered: boolean = false
    const maximumLength = Math.max(40, 80 - (indent * 4))
    for (let node of contents) {
        switch(node.tag) {
            case 'Whitespace':
                whiteSpaceBuffered = true
                displayingTagsNested = false
                trailingTokens = false
                bufferNested = ''
                break
            case 'String':
                displayingTagsNested = false
                trailingTokens = false
                const stringTokens = node.value.split(/\s+/)
                if (whiteSpaceBuffered) {
                    if (`${bufferFlat} ${stringTokens[0]}`.length < maximumLength) {
                        bufferFlat = `${bufferFlat} ${stringTokens[0]}`
                    }
                    else {
                        yield `${bufferFlat}`
                        bufferFlat = stringTokens[0]
                    }
                    whiteSpaceBuffered = false
                }
                else if (`${bufferFlat}${stringTokens[0]}`.length >= maximumLength) {
                    //
                    // If a previous tag buffer needs to be nested in order to word-wrap
                    // because of the first token in the string, do that here
                    //
                    const { last, previous } = lastItem(bufferNested.split('\n'))
                    for (let output of previous) {
                        yield output
                    }
                    bufferFlat = `${last}${stringTokens[0]}`
                }
                else {
                    bufferFlat = `${bufferFlat}${stringTokens[0]}`
                }
                for (let stringToken of stringTokens.slice(1)) {
                    if (`${bufferFlat} ${stringToken}`.length >= maximumLength) {
                        yield `${bufferFlat}`
                        bufferFlat = stringToken
                        trailingTokens = false
                    }
                    else {
                        bufferFlat = `${bufferFlat} ${stringToken}`
                        trailingTokens = true
                    }
                }
                bufferNested = ''
                break
            case 'Link':
                //
                // Maintain buffers for both nested and non-nested versions of the prettyPrint, until you can either use the non-nested
                // or need to discard it and move forward in nesting-only mode for as long as tags are connected.
                //
                const { cached: flatCache } = prettyPrintEvaluate({ source, tokens })({ node, indent, mode: PrettyPrintEvaluations.NoNesting })
                const { cached: nestedCache } = prettyPrintEvaluate({ source, tokens })({ node, indent, mode: PrettyPrintEvaluations.MustNest })
                if (whiteSpaceBuffered) {
                    yield `${bufferFlat}`
                    bufferFlat = ''
                    whiteSpaceBuffered = false
                }
                //
                // If you are not already displaying tags nested then check whether you need to
                // start doing so
                //
                if (`${bufferFlat}${flatCache}`.length >= maximumLength) {
                    //
                    // If the buffer has a wrappable string, see if you can fit the whole tag by pulling the last token
                    // of that string to a new line
                    //
                    if (trailingTokens && `${lastItem(bufferFlat.split(' ')).last}${flatCache}`.length < maximumLength) {
                        const { last, previous } = lastItem(bufferFlat.split(' '))
                        yield previous.join(' ')
                        bufferFlat = last
                    }
                    else {
                        const { last: lastBuffer, previous: nestedLines } = lastItem(bufferNested.split('\n'))
                        for (let output of nestedLines) {
                            yield output
                        }
                        bufferFlat = lastBuffer
                        bufferNested = ''
                        displayingTagsNested = true
                    }
                }
                if (displayingTagsNested) {
                    const { last, previous } = lastItem(nestedCache.split('\n'))
                    if (previous.length) {
                        yield `${bufferFlat}${previous[0]}`
                        for (let output of previous.slice(1)) {
                            yield output
                        }
                        bufferFlat = last
                    }
                    else {
                        bufferFlat = `${bufferFlat}${last}`
                    }
                }
                else {
                    //
                    // If setting bufferNested for the first time, bring in previous flat buffer contents
                    //
                    bufferNested = bufferNested || bufferFlat
                    //
                    // Then add to each buffer, flat and nested
                    //
                    bufferFlat = `${bufferFlat}${flatCache}`
                    bufferNested = `${bufferNested}${nestedCache}`
                }
                trailingTokens = false
                break
            case 'br':
                yield bufferFlat
                yield '<br />'
                bufferFlat = ''
                whiteSpaceBuffered = false
                trailingTokens = false
                displayingTagsNested = false
                bufferNested = ''
                break
        }
    }
    if (bufferFlat) {
        yield bufferFlat
    }
}

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
        const selfClosing = selfClosingTags.includes(node.tag) && node.contents.length === 0
        const tagOpenSrc = prettyPrintTagOpen({ tagOpen: tagOpenResults, mode: PrettyPrintEvaluations.NoNesting, selfClosing, indent })
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
            if (node.tag === 'Description') {
                //
                // TODO: Add more sophisticated word-wrap functionality on Description
                //
                const contents = trimWhitespaceEnds(node.contents)
                const descriptionSource = [...descriptionWrap({
                    source,
                    tokens,
                    contents,
                    indent: indent + 1
                })].join('\n')
                return {
                    tag: node,
                    evaluation: PrettyPrintEvaluations.HasTagsToInheritNesting,
                    cached: `${tagOpenSrc}\n${prettyPrintIndent(1)(descriptionSource)}\n</${node.tag}>`
                }
            }
            else {
                //
                // If one of the subordinate nodes must nest, or if it is a tag of its own, then nest all.
                //
                const contents = node.contents.map((item: ParseTag) => (prettyPrintEvaluate({ source, tokens })({ node: item, indent: indent + 1 })))
                if (mode === PrettyPrintEvaluations.MustNest || contents.find(({ evaluation }) => ([PrettyPrintEvaluations.MustNest, PrettyPrintEvaluations.HasTagsToInheritNesting].includes(evaluation)))) {
                    const contentsSource = contents.map(({ cached }) => (cached)).filter((value) => (value)).join('\n')
                    return {
                        tag: node,
                        evaluation: mode === PrettyPrintEvaluations.MustNest ? PrettyPrintEvaluations.MustNest : PrettyPrintEvaluations.HasTagsToInheritNesting,
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
    }
    else {
        return {
            tag: node,
            evaluation: PrettyPrintEvaluations.HasTagsToInheritNesting,
            cached: prettyPrintTagOpen({ tagOpen: tagOpenResults, mode: PrettyPrintEvaluations.NoNesting, selfClosing: true, indent })
        } 
    }
}

export const prettyPrint = ({ tokens, schema, source }: { tokens: Token[]; schema: SchemaTag[]; source: string }): string => {
    // console.log(`Tokens: ${JSON.stringify(tokens, null, 4)}`)
    const evaluator = prettyPrintEvaluate({ tokens, source })
    return schema.map(({ parse }) => (evaluator({ node: parse }))).map(({ cached }) => (cached)).join('')
}

export default prettyPrint
