import { Normalizer } from '../normalize'
import { NormalForm, ComponentRenderItem } from '../normalize/baseClasses'

import parse from '../parser'
import { ParseException, ParseTag } from '../parser/baseClasses'
import tokenizer from '../parser/tokenizer'
import { isTokenValue, Token, TokenizeException, TokenProperty, TokenValue, TokenWhitespace } from '../parser/tokenizer/baseClasses'
import SourceStream from '../parser/tokenizer/sourceStream'

import { schemaFromParse } from '../schema'
import { isSchemaDescription, isSchemaWithContents, SchemaLineBreakTag, SchemaLinkTag, SchemaTag, SchemaWithContents } from '../schema/baseClasses'

import { SearchParse } from './search/baseClasses'
import searchParse from './search/parse'
import searchTokenize from './search/tokenize'

import { wmlSelectorFactory } from './selector'
import prettyPrint from './prettyPrint'

export interface WMLQueryUpdateReplace {
    type: 'replace';
    startIdx: number;
    endIdx: number;
    text: string;
    wmlQuery: WMLQuery;
}

export interface WMLQueryUpdateSet {
    type: 'set';
    text: string;
    wmlQuery: WMLQuery;
}

export type WMLQueryUpdate = WMLQueryUpdateReplace | WMLQueryUpdateSet

type WMLQueryOptions = {
    onChange?: (update: WMLQueryUpdate) => void;
}

const renderFromNode = (normalForm) => ({ tag, type, value = '', props = {}, contents = [] }) => {
    switch(type) {
        case 'tag':
            const flattenedProps = (Object.entries(props) as [string, { value: any }][])
                .reduce((previous, [key, { value }]) => ({ ...previous, [key]: value }), {} as Record<string, any>)
            return {
                tag,
                ...flattenedProps,
                text: contents.map(renderFromNode(normalForm)).filter((item) => (typeof item !== 'object')).join(''),
                targetTag: normalForm[flattenedProps.to]?.tag === 'Action' ? 'Action' : 'Feature'
            }
        default:
            return value
    }
}

const renderFromNewNode = (normalForm) => (node: SchemaTag): ComponentRenderItem => {
    switch(node.tag) {
        case 'Link':
            return {
                tag: 'Link',
                text: node.text,
                to: node.to,
                targetTag: normalForm[node.to]?.tag === 'Action' ? 'Action' : 'Feature'
            }
        case 'br':
            return {
                tag: 'LineBreak'
            }
        case 'String':
            return {
                tag: 'String',
                value: node.value
            }
        default:
            return {
                tag: 'String',
                value: ''
            }
    }
}

const isSameSchemaTag = (a: SchemaTag) => (b: SchemaTag) => (
    (a.parse.startTagToken === b.parse.startTagToken) && (a.parse.endTagToken === b.parse.endTagToken)
)

type FindPropertyTokensReturn = {
    propertyToken?: TokenProperty;
    valueToken?: TokenValue;
    replaceRange: {
        start: number;
        end: number;
    }
}

export class WMLQueryResult {
    search: { search?: SearchParse[]; not?: SearchParse[] }[] = []
    extendsResult?: WMLQueryResult;
    wmlQuery: WMLQuery;
    _nodes: SchemaTag[] = [];
    constructor(wmlQuery: WMLQuery, { search, extendsResult }: { search?: SearchParse[], extendsResult?: WMLQueryResult }) {
        this.wmlQuery = wmlQuery
        if (search) {
            this.search = [{
                search
            }]
        }
        if (extendsResult) {
            this.extendsResult = extendsResult
            this.search = extendsResult.search
        }
        this.refresh()
    }

    refresh(): void {
        if (this.wmlQuery._schema.length) {
            this._nodes = this.search.reduce((previous, { search, not }) => {
                if (search) {
                    return wmlSelectorFactory(this.wmlQuery._schema, { currentNodes: previous })(search)
                }
                if (not) {
                    const excludeResults = new WMLQueryResult(this.wmlQuery, { search: not })
                    const excludeStarts = excludeResults.nodes()
                    return (previous || []).filter((potential) => (!excludeStarts.find(isSameSchemaTag(potential))))
                }
            }, undefined as (SchemaTag[] | undefined)) || []
        }
        else {
            this._nodes = []
        }
        if (this.extendsResult) {
            this.extendsResult.refresh()
        }
    }

    nodes(): SchemaTag[] {
        return this._nodes || []
    }

    get count(): number {
        return (this._nodes || []).length
    }

    get source(): string {
        return this.wmlQuery.source
    }

    //
    // findPropertyTokens digs into the parse data, and from there into the token data, to find property values directly (even if they
    // don't make it into the schema)
    //
    // Returns:
    //    - propertyToken: The token (if any) that defines the key
    //    - valueToken:  The token (if any) that defines the value.  Only present if propertyToken is present (and not then, for boolean
    //        properties)
    //    - replaceRange:  { start, end } indexes into the source string, that tell what string should be replaced in order to remove
    //        or update this property.
    //            If property present:
    //                - Starts at the start of whitespace before the property, ends at the end of the boolean property or value token
    //            If property not present:
    //                - Starts and ends at the start of whitespace before the TagOpenEnd token
    //
    _findPropertyTokens(node: SchemaTag, key: string): (FindPropertyTokensReturn | undefined) {
        let searchTokens = this.wmlQuery._tokens.slice(node.parse.startTagToken, node.parse.endTagToken + 1)
        if (searchTokens.length === 0) {
            throw new ParseException('Misconfigured parse values', node.parse.startTagToken, node.parse.endTagToken)
        }
        let index = 1
        while(index < searchTokens.length) {
            const currentToken = searchTokens[index]
            if (currentToken.type === 'Property' && currentToken.key === key) {
                let backTrack = index
                while (backTrack > 1 && searchTokens[backTrack - 1].type === 'Whitespace') {
                    backTrack--
                }
                if (currentToken.isBoolean) {
                    return {
                        propertyToken: currentToken,
                        replaceRange: {
                            start: searchTokens[backTrack].startIdx,
                            end: currentToken.endIdx + 1
                        }
                    }
                }
                else {
                    index++
                    while((index < searchTokens.length - 1) && searchTokens[index].type === 'Whitespace') {
                        index++
                    }
                    if (index >= searchTokens.length) {
                        throw new ParseException('Misconfigured property values', node.parse.startTagToken + index, node.parse.startTagToken + index)
                    }
                    const valueToken = searchTokens[index]
                    if (!isTokenValue(valueToken)) {
                        throw new ParseException('Misconfigured property values', node.parse.startTagToken + index, node.parse.startTagToken + index)
                    }
                    else {
                        let lastToken: TokenValue | TokenWhitespace = valueToken
                        index++
                        while((index < searchTokens.length - 1)) {
                            const whitespaceToken =  searchTokens[index]
                            if (whitespaceToken.type === 'Whitespace') {
                                lastToken = whitespaceToken
                                index++
                            }
                            else {
                                break
                            }
                        }
                        return {
                            propertyToken: currentToken,
                            valueToken,
                            replaceRange: {
                                start: searchTokens[backTrack].startIdx,
                                end: valueToken.endIdx + 1
                            }
                        }
                    }
                }
            }
            if (currentToken.type === 'TagOpenEnd') {
                //
                // No property has been found.  Backtrack from the TagOpenEnd for as long as you find
                // uninterrupted whitespace, and take the first point of that white space to return as
                // a replace range
                //
                let backTrack = index
                while (backTrack > 1 && searchTokens[backTrack - 1].type === 'Whitespace') {
                    backTrack--
                }
                return {
                    replaceRange: {
                        start: searchTokens[backTrack].startIdx,
                        end: searchTokens[backTrack].startIdx
                    }
                }
            }
            index++
        }
    }

    //
    // findContentsRange digs into a schema tag 
    //
    _findContentsRange(node: SchemaWithContents): { startIdx: number; endIdx: number } {
        const { parse } = node
        let startToken = parse.startTagToken
        while(startToken < parse.endTagToken - 1) {
            if (this.wmlQuery._tokens[startToken].type === 'TagOpenEnd') {
                break
            }
            startToken++
        }
        let endToken = parse.endTagToken
        while(endToken > startToken + 1) {
            if (this.wmlQuery._tokens[endToken].type === 'TagClose') {
                break
            }
            endToken--
        }
        const startIdx = this.wmlQuery._tokens[startToken].endIdx + 1
        const endIdx = this.wmlQuery._tokens[endToken].startIdx
        return { startIdx, endIdx }
    }

    prop(key: string, value?: undefined, options?: undefined): any
    prop(key: string, value: any, options?: { type: 'literal' | 'boolean' | 'expression' | 'key' }): WMLQueryResult
    prop(key: string, value?: any, options: { type: 'literal' | 'boolean' | 'expression' | 'key' } = { type: 'literal' }): WMLQueryResult | any {
        if (value !== undefined) {
            const { type } = options
            this._nodes.forEach((node) => {
                const { replaceRange } = this._findPropertyTokens(node, key) || {}
                const newProp = type === 'boolean'
                    ? value ? `${key}` : ''
                    : type === 'expression'
                        ? `${key}={${value}}`
                        : type === 'key'
                            ? `${key}=(${value})`
                            : `${key}="${value}"`
                this.wmlQuery.replaceInputRange(replaceRange.start, replaceRange.end, newProp ? ` ${newProp}` : '')
            })
            this.refresh()
            return this
        }
        else {
            if (this._nodes.length) {
                const { propertyToken, valueToken } = this._findPropertyTokens(this._nodes[0], key) || {}
                if (propertyToken) {
                    if (propertyToken.isBoolean) {
                        return true
                    }
                    else {
                        return valueToken.value
                    }
                }
                else {
                    return undefined
                }
            }
            return undefined
        }
    }

    removeProp(key: string): WMLQueryResult {
        this._nodes.forEach((node) => {
            const { replaceRange } = this._findPropertyTokens(node, key) || {}
            if (replaceRange.start !== replaceRange.end) {
                this.wmlQuery.replaceInputRange(replaceRange.start, replaceRange.end, '')
            }
        })
        this.refresh()
        return this
    }

    expand(): void {
        this._nodes.filter(isSchemaWithContents).forEach((node) => {
            const endTagToken = this.wmlQuery._tokens[node.parse.endTagToken]
            const selfClosed = endTagToken.type === 'TagOpenEnd' && endTagToken.selfClosing
            if (selfClosed) {
                //
                // Unwrap the self-closed tag into an explicit one before trying
                // to insert content
                //
                const replaceValue = `></${node.tag}>`
                this.wmlQuery.replaceInputRange(endTagToken.startIdx, endTagToken.endIdx + 1, replaceValue)
                this.refresh()
            }
        })
    }

    contents(value?: undefined): SchemaTag[]
    contents(value: string): WMLQueryResult
    contents(value?: string): WMLQueryResult | SchemaTag[] {
        if (value !== undefined) {
            this.expand()
            let replaceRanges: { startIdx: number; endIdx: number }[] = []
            this._nodes
                .filter(isSchemaWithContents)
                .forEach((node) => {
                    replaceRanges.push(this._findContentsRange(node))
                })
            let offset = 0
            replaceRanges.forEach(({ startIdx, endIdx }) => {
                this.wmlQuery.replaceInputRange(startIdx + offset, endIdx + offset, value)
                offset += value.length + (startIdx - endIdx)
            })
            this.refresh()
            return this
        }
        else {
            if (this._nodes.length) {
                const firstNode = this._nodes[0]
                if (isSchemaWithContents(firstNode)) {
                    return firstNode.contents
                }
            }
            return []
        }
    }

    render(value?: undefined): ComponentRenderItem[]
    render(value: ComponentRenderItem[]): WMLQueryResult
    render(value?: ComponentRenderItem[]): WMLQueryResult | ComponentRenderItem[] {
        if (value !== undefined) {
            const renderContents = value.map((item) => {
                switch(item.tag) {
                    case 'Link':
                        return `<Link to=(${item.to})>${item.text}</Link>`
                    case 'LineBreak':
                        return '<br />'
                    case 'String':
                        return item.value
                }
            })
            const revisedContents = renderContents.join("")
            let replaceRanges: { startIdx: number; endIdx: number }[] = []
            this._nodes
                .filter(isSchemaWithContents)
                .forEach((node) => {
                    replaceRanges.push(this._findContentsRange(node))
                })
            let offset = 0
            replaceRanges.forEach(({ startIdx, endIdx }) => {
                this.wmlQuery.replaceInputRange(startIdx + offset, endIdx + offset, revisedContents)
                offset += revisedContents.length + (startIdx - endIdx)
            })
            this.refresh()
            return this
        }
        else {
            if (this._nodes.length) {
                const firstNode = this._nodes[0]
                if (isSchemaDescription(firstNode)) {
                    return (firstNode.contents || [])
                        .filter(({ tag }) => (
                            tag === 'String' || tag === 'Link'
                        ))
                        .map(renderFromNewNode(this.wmlQuery.normalize()))
                }
            }
            return []
        }
    }

    not(searchString: string): WMLQueryResult {
        const parsedSearch = searchParse(searchTokenize(new SourceStream(searchString)))
        this.search = [
            ...this.search,
            {
                not: parsedSearch
            }
        ]
        this.refresh()
        return this
    }

    add(searchString: string): WMLQueryResult {
        const parsedSearch = searchParse(searchTokenize(new SourceStream(searchString)))
        this.search = [
            ...this.search,
            {
                search: parsedSearch
            }
        ]
        this.refresh()
        return this
    }

    remove(): WMLQueryResult {
        let offset = 0
        let removes: { startIdx, endIdx }[] = []
        this._nodes.forEach(({ parse }) => {
            const startIdx = this.wmlQuery._tokens[parse.startTagToken].startIdx
            const endIdx = this.wmlQuery._tokens[parse.endTagToken].endIdx
            removes.push({ startIdx: startIdx - offset, endIdx: endIdx + 1 - offset })
            offset += endIdx + 1 - startIdx
        })
        removes.forEach(({ startIdx, endIdx }) => {
            this.wmlQuery.replaceInputRange(startIdx, endIdx, '')
        })
        this.refresh()
        return this
    }

    extend(): WMLQueryResult {
        return new WMLQueryResult(this.wmlQuery, { extendsResult: this })
    }

    addElement(source: string, options?: { position: 'before' | 'after' }): WMLQueryResult {
        this.expand()
        const { position = 'after' } = options || {}
        this._nodes.forEach((node) => {
            if (isSchemaWithContents(node)) {
                const { contents }: { contents: SchemaTag[] } = node
                let insertPosition: number = (position === 'before')
                    ? contents.reduce((previous: number, { parse }) => (Math.min(previous, this.wmlQuery._tokens[parse.startTagToken].startIdx)), Infinity)
                    : contents.reduce((previous: number, { parse }) => (Math.max(previous, this.wmlQuery._tokens[parse.endTagToken].endIdx + 1)), -Infinity)
                if (insertPosition === Infinity || insertPosition === -Infinity) {
                    const { startIdx } = this._findContentsRange(node)
                    insertPosition = startIdx
                }
                this.wmlQuery.replaceInputRange(insertPosition, insertPosition, source)
                this.refresh()
            }
        })
        return this
    }

    children(): WMLQueryResult {
        this._nodes = this._nodes
            .filter(isSchemaWithContents)
            .reduce((previous, { contents }) => ([...previous, ...contents]), [])
        return this
    }

}

export class WMLQuery {
    onChange: (value: any) => void
    _source: string;
    _tokens: Token[] = [];
    _parse: ParseTag[] = [];
    _schema: SchemaTag[] = [];
    _valid: boolean = false;
    _error: string = '';
    _errorStart: number | undefined;
    _errorEnd: number | undefined;

    constructor(sourceString: string, options: WMLQueryOptions = {}) {
        const { onChange = () => {} } = options
        this.onChange = onChange
        this._source = sourceString
        this._errorHandler(() => {
            this._tokens = tokenizer(new SourceStream(this._source))
            this.refresh()    
        })
    }

    _errorHandler(callback: () => void): void {
        try {
            callback()
            this._valid = true
            this._error = ''
            this._errorStart = undefined
            this._errorEnd = undefined
        }
        catch (err) {
            this._valid = false
            if (err instanceof TokenizeException) {
                this._error = err.message
                this._errorStart = err.startIdx
                this._errorEnd = err.endIdx
            }
            else if (err instanceof ParseException) {
                this._error = err.message
                this._errorStart = this._tokens[err.startToken].startIdx
                this._errorEnd = this._tokens[err.endToken].endIdx
            }
            else {
                this._error = 'Unknown exception'
                this._errorStart = undefined
                this._errorEnd = undefined
            }
        }
    }

    get source(): string {
        return this._source
    }

    get valid(): boolean {
        return this._valid
    }

    refresh(): void {
        this._parse = parse(this._tokens)
        this._schema = schemaFromParse(this._parse)
    }

    setInput(str: string): void {
        this._source = str
        this._errorHandler(() => {
            this._tokens = tokenizer(new SourceStream(this._source))
            this.refresh()
        })
        this.onChange({
            type: 'set',
            text: str,
            wmlQuery: this
        })
    }

    normalize(): NormalForm {
        const normalizer = new Normalizer()
        this._schema.forEach((tag, index) => {
            normalizer.add(tag, { contextStack: [], location: [index] })
        })
        return normalizer.normal
    }
    prettyPrint(): WMLQuery {
        // if (this.matcher.match().succeeded()) {
        //     const prettyPrinted = wmlSemantics(this.matcher.match()).prettyPrint
        //     this.matcher.setInput(prettyPrinted)
        // }
        const prettyPrintedSource = prettyPrint({ tokens: this._tokens, schema: this._schema, source: this._source })
        this.setInput(prettyPrintedSource)
        return this
    }
    replaceInputRange(startIdx: number, endIdx: number, str: string): void {
        const newSource = `${this._source.slice(0, startIdx)}${str}${this._source.slice(endIdx)}`
        // console.log(`newSource: ${newSource}`)
        this._source = newSource
        //
        // TODO:  Use previous tokenizer results in recalculating tokens (earlier tokens are
        // unchanged, and once the tokens start matching after leaving the new section (if they do),
        // the new tokens are just index-shifted versions of the old)
        //
        this._errorHandler(() => {
            this._tokens = tokenizer(new SourceStream(this._source))
            this.refresh()
        })
        this.onChange({
            type: 'replace',
            startIdx,
            endIdx,
            text: str,
            wmlQuery: this
        })
    }

    search(search: string): WMLQueryResult {
        const parsedSearch = searchParse(searchTokenize(new SourceStream(search)))
        return new WMLQueryResult(this, { search: parsedSearch })
    }

    clone(): WMLQuery {
        return new WMLQuery(this._source)
    }

}
