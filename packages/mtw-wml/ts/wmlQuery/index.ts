import { NormalForm, ComponentRenderItem } from '../normalize'
import { Matcher } from 'ohm-js'

import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'

import { wmlSelectorFactory } from './selector.js'
import { schemaFromParse, validatedSchema, wmlSemantics } from '../index'
import { normalize } from '../normalize'
import parse from '../parser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import { SearchParse } from './search/baseClasses'
import { ParseException, ParseTag } from '../parser/baseClasses'
import { isTokenValue, isTokenWhitespace, Token, TokenProperty, TokenTagOpenEnd, TokenValue, TokenWhitespace } from '../parser/tokenizer/baseClasses'
import { SchemaTag } from '../schema/baseClasses'
import { newWMLSelectorFactory } from './newSelector'
import searchParse from './search/parse'
import searchTokenize from './search/tokenize'

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

const isSameSchemaTag = (a: SchemaTag) => (b: SchemaTag) => (
    (a.parse.startTagToken === b.parse.startTagToken) && (a.parse.endTagToken === b.parse.endTagToken)
)

type FindPropertyTokensReturn = {
    propertyToken?: TokenProperty;
    valueToken?: TokenValue;
    lastToken?: TokenProperty | TokenValue | TokenWhitespace;
    insertPoint?: number;
}

export class NewWMLQueryResult {
    search: { search?: SearchParse[]; not?: SearchParse[] }[] = []
    extendsResult?: NewWMLQueryResult;
    wmlQuery: NewWMLQuery;
    _nodes: SchemaTag[] = [];
    constructor(wmlQuery: NewWMLQuery, { search, extendsResult }: { search?: SearchParse[], extendsResult?: NewWMLQueryResult }) {
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
                    return newWMLSelectorFactory(this.wmlQuery._schema, { currentNodes: previous })(search)
                }
                if (not) {
                    const excludeResults = new NewWMLQueryResult(this.wmlQuery, { search: not })
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

    get source(): string {
        return this.wmlQuery.source
    }

    //
    // findPropertyTokens digs into the parse data, and from there into the token data, to find property values directly (even if they
    // don't make it into the schema)
    //
    _findPropertyTokens(node: SchemaTag, key: string, options: { trailingWhitespace?: boolean } = {}): (FindPropertyTokensReturn | undefined) {
        let searchTokens = this.wmlQuery._tokens.slice(this._nodes[0].parse.startTagToken, this._nodes[0].parse.endTagToken)
        if (searchTokens.length === 0) {
            throw new ParseException('Misconfigured parse values', this._nodes[0].parse.startTagToken, this._nodes[0].parse.endTagToken)
        }
        let index = 1
        let insertPoint = searchTokens[1].endIdx
        while(index < searchTokens.length) {
            const currentToken = searchTokens[index]
            if (currentToken.type === 'Property' && currentToken.key === key) {
                if (currentToken.isBoolean) {
                    let lastToken: TokenProperty | TokenWhitespace = currentToken
                    if (options.trailingWhitespace) {
                        index++
                        while(index < searchTokens.length - 1) {
                            const whitespaceToken =  searchTokens[index]
                            if (whitespaceToken.type === 'Whitespace') {
                                lastToken = whitespaceToken
                                index++
                            }
                            else {
                                break
                            }
                        }    
                    }
                    return {
                        propertyToken: currentToken,
                        lastToken
                    }
                }
                else {
                    index++
                    while((index < searchTokens.length - 1) && searchTokens[index].type === 'Whitespace') {
                        index++
                    }
                    if (index >= searchTokens.length) {
                        throw new ParseException('Misconfigured property values', this._nodes[0].parse.startTagToken + index, this._nodes[0].parse.startTagToken + index)
                    }
                    const valueToken = searchTokens[index]
                    if (!isTokenValue(valueToken)) {
                        throw new ParseException('Misconfigured property values', this._nodes[0].parse.startTagToken + index, this._nodes[0].parse.startTagToken + index)
                    }
                    else {
                        let lastToken: TokenValue | TokenWhitespace = valueToken
                        if (options.trailingWhitespace) {
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
                        }
                        return {
                            propertyToken: currentToken,
                            valueToken,
                            lastToken
                        }
                    }
                }
            }
            if (isTokenValue(currentToken) || isTokenWhitespace(currentToken)) {
                insertPoint = currentToken.endIdx + 1
            }
            if (currentToken.type === 'TagOpenEnd') {
                return {
                    insertPoint
                }
            }
            index++
        }
    }

    prop(key: string, value?: undefined, options?: undefined): any
    prop(key: string, value: any, options?: { type: 'literal' | 'boolean' | 'expression' | 'key' }): WMLQueryResult
    prop(key: string, value?: any, options: { type: 'literal' | 'boolean' | 'expression' | 'key' } = { type: 'literal' }): WMLQueryResult | any {
        if (value !== undefined) {
            const { type } = options
            this._nodes.forEach((node) => {
                const { propertyToken, lastToken, insertPoint } = this._findPropertyTokens(node, key) || {}
                const newProp = type === 'boolean'
                    ? value ? `${key}` : ''
                    : type === 'expression'
                        ? `${key}={${value}}`
                        : type === 'key'
                            ? `${key}=(${value})`
                            : `${key}="${value}"`
                if (propertyToken) {
                    const startIdx = propertyToken.startIdx
                    const endIdx = (lastToken || propertyToken).endIdx + 1
                    this.wmlQuery.replaceInputRange(startIdx, endIdx, newProp)
                }
                else {
                    this.wmlQuery.replaceInputRange(insertPoint, insertPoint, newProp ? ` ${newProp}` : '')
                }
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

    removeProp(key: string): NewWMLQueryResult {
        this._nodes.forEach((node) => {
            const { propertyToken, lastToken } = this._findPropertyTokens(node, key, { trailingWhitespace: true }) || {}
            if (propertyToken) {
                const startIdx = propertyToken.startIdx
                const endIdx = (lastToken || propertyToken).endIdx + 1
                this.wmlQuery.replaceInputRange(startIdx, endIdx, '')
            }
        })
        this.refresh()
        return this
    }
}

export class WMLQueryResult {
    search: { search?: string; not?: string }[] = []
    extendsResult?: WMLQueryResult
    wmlQuery: WMLQuery
    _nodes: any[] = []
    constructor(wmlQuery: WMLQuery, { search, extendsResult }: { search?: string, extendsResult?: WMLQueryResult }) {
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
        const match = this.wmlQuery.matcher.match()
        if (match.succeeded()) {
            this._nodes = this.search.reduce((previous, { search, not }) => {
                if (search) {
                    return wmlSelectorFactory(match, { currentNodes: previous })(search) as any[]
                }
                if (not) {
                    const excludeResults = new WMLQueryResult(this.wmlQuery, { search: not })
                    const excludeStarts = excludeResults.nodes().map(({ start }) => (start))
                    return (previous || []).filter(({ start }) => (!excludeStarts.includes(start)))
                }
            }, undefined as (any[] | undefined)) || []
        }
        else {
            this._nodes = []
        }
        if (this.extendsResult) {
            this.extendsResult.refresh()
        }
    }

    not(searchString: string): WMLQueryResult {
        this.search = [
            ...this.search,
            {
                not: searchString
            }
        ]
        this.refresh()
        return this
    }

    add(searchString: string): WMLQueryResult {
        this.search = [
            ...this.search,
            {
                search: searchString
            }
        ]
        this.refresh()
        return this
    }

    replaceInputRange(startIdx: number, endIdx: number, value: string): void {
        this.wmlQuery.replaceInputRange(startIdx, endIdx, value)
    }

    get source(): string {
        return this.wmlQuery.source
    }

    nodes(): any[] {
        return this._nodes || []
    }

    get count(): number {
        return (this._nodes || []).length
    }

    expand(): void {
        let offset = 0
        this._nodes.forEach(({ type, tag, end }) => {
            if (type !== 'tag') {
                return
            }
            const selfClosed = this.wmlQuery.source.slice(end + offset - 2, end + offset) === '/>'
            if (selfClosed) {
                //
                // Unwrap the self-closed tag into an explicit one before trying
                // to insert content
                //
                const trimmedPrepend = this.wmlQuery.source.slice(0, end + offset - 2).trimEnd()
                const replaceValue = `${trimmedPrepend}></${tag}>`
                this.wmlQuery.replaceInputRange(0, end + offset, replaceValue)
                offset = replaceValue.length - end
            }
        })
        this.refresh()
    }

    addElement(source: string, options?: { position: 'before' | 'after' }): WMLQueryResult {
        this.expand()
        const { position = 'after' } = options || {}
        this._nodes.forEach(({ type, tag, tagEnd, contentsStart, end, contents = [] }) => {
            if (type !== 'tag') {
                return
            }
            const selfClosed = this.wmlQuery.source.slice(end - 2, end) === '/>'
            let insertPosition
            if (selfClosed) {
                //
                // Unwrap the self-closed tag into an explicit one before trying
                // to insert content
                //
                const trimmedPrepend = this.wmlQuery.source.slice(0, end - 2).trimEnd()
                this.wmlQuery.replaceInputRange(0, end, `${trimmedPrepend}></${tag}>`)
                insertPosition = trimmedPrepend.length + 1
            }
            else {
                insertPosition = position === 'before'
                    ? contents.reduce((previous, { start }) => (Math.min(previous, start)), Infinity)
                    : contents.reduce((previous, { end }) => (Math.max(previous, end)), -Infinity)
                insertPosition = (insertPosition === Infinity || insertPosition === -Infinity) ? contentsStart : insertPosition
            }
            this.wmlQuery.replaceInputRange(insertPosition, insertPosition, source)
        })
        return this
    }

    remove(): WMLQueryResult {
        let offset = 0
        this._nodes.forEach(({ start, end }) => {
            this.replaceInputRange(start - offset, end - offset, '')
            offset += end - start
        })
        this.refresh()
        return this
    }

    children(): WMLQueryResult {
        this._nodes = this._nodes.reduce((previous, { contents = [] }) => ([...previous, ...contents]), [])
        return this
    }

    prepend(sourceString: string): WMLQueryResult {
        if (this._nodes.length) {
            this.replaceInputRange(this._nodes[0].start, this._nodes[0].start, sourceString)
            this.refresh()
        }
        return this
    }

    prop(key: string, value?: any, options: { type: 'literal' | 'boolean' | 'expression' } = { type: 'literal' }): WMLQueryResult | any {
        if (value !== undefined) {
            const { type } = options
            this._nodes.forEach((node) => {
                if (node.props[key]) {
                    if (type === 'boolean') {
                        if (value === false) {
                            const { start, end } = node.props[key]
                            if (end) {
                                this.replaceInputRange(start-1, end, '')
                            }
                        }
                    }
                    else {
                        const { valueStart, valueEnd } = node.props[key]
                        if (valueEnd) {
                            this.replaceInputRange(valueStart, valueEnd, value)
                        }
                    }
                }
                else {
                    const insertAfter = (Object.values(node.props || {}) as { end: number }[])
                        .reduce((previous, { end }: { end: number }) => (Math.max(previous, end)), node.tagEnd as number)
                    const newProp = type === 'boolean'
                        ? value ? ` ${key}` : ''
                        : type === 'expression'
                            ? ` ${key}={${value}}`
                            : ` ${key}="${value}"`
                    this.replaceInputRange(insertAfter, insertAfter, newProp)
                }
            })
            this.refresh()
            return this
        }
        else {
            if (this._nodes.length) {
                return this._nodes[0].props[key]?.value
            }
            return undefined
        }
    }

    removeProp(key: string): WMLQueryResult {
        this._nodes.forEach((node) => {
            if (node.props[key]) {
                const { start, end } = node.props[key]
                if (end) {
                    this.replaceInputRange(start-1, end, '')
                }
            }
        })
        this.refresh()
        return this
    }

    contents(value?: undefined): any[]
    contents(value: any): WMLQueryResult
    contents(value?: any): WMLQueryResult | any[] {
        this.expand()
        if (value !== undefined) {
            let offset = 0
            this._nodes.forEach(({ contentsStart, contentsEnd }) => {
                this.replaceInputRange(contentsStart + offset, contentsEnd + offset, value)
                offset += contentsStart + value - contentsEnd
            })
            this.refresh()
            return this
        }
        else {
            if (this._nodes.length) {
                return this._nodes[0].contents || []
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
            let offset = 0
            this._nodes.forEach(({ contentsStart, contentsEnd }) => {
                this.replaceInputRange(contentsStart+offset, contentsEnd+offset, revisedContents)
                offset += revisedContents.length - (contentsEnd - contentsStart)
            })
            this.refresh()
            return this
        }
        else {
            if (this._nodes.length && ['Description'].includes(this._nodes[0].tag)) {
                return (this._nodes[0].contents || [])
                    .filter(({ tag, type }) => (
                        type === 'string' || tag === 'Link'
                    ))
                    .map(renderFromNode(this.wmlQuery.normalize()))
            }
            return []
        }
    }

    prettyPrint(): WMLQueryResult {
        this.wmlQuery.prettyPrint()
        this.refresh()
        return this
    }

    clone(): WMLQueryResult {
        const newQuery = this.wmlQuery.clone()
        const newQueryResult = newQuery.search('')
        newQueryResult.search = this.search
        newQueryResult.refresh()
        return newQueryResult
    }

    extend(): WMLQueryResult {
        return new WMLQueryResult(this.wmlQuery, { extendsResult: this })
    }

}

export class WMLQuery {
    onChange: (value: any) => void
    matcher: Matcher

    constructor(sourceString: string, options: WMLQueryOptions = {}) {
        const { onChange = () => {} } = options
        this.onChange = onChange
        this.matcher = wmlGrammar.matcher()
        this.matcher.setInput(sourceString)
    }

    get source(): string {
        return this.matcher.getInput()
    }
    setInput(str: string): void {
        this.matcher.setInput(str)
        this.onChange({
            type: 'set',
            text: str,
            wmlQuery: this
        })
    }
    normalize(): NormalForm {
        // if (this.matcher.getInput()) {
        //     const schema = schemaFromParse(parse(tokenizer(new SourceStream(this.matcher.getInput()))))
        //     return normalize(schema)
        // }
        if (this.matcher.match().succeeded()) {
            const schema = validatedSchema(this.matcher.match())
            return normalize(schema)    
        }
        else {
            return {}
        }
    }
    prettyPrint(): WMLQuery {
        if (this.matcher.match().succeeded()) {
            const prettyPrinted = wmlSemantics(this.matcher.match()).prettyPrint
            this.matcher.setInput(prettyPrinted)
        }
        return this
    }
    replaceInputRange(startIdx: number, endIdx: number, str: string): void {
        this.matcher.replaceInputRange(startIdx, endIdx, str)
        this.onChange({
            type: 'replace',
            startIdx,
            endIdx,
            text: str,
            wmlQuery: this
        })
    }

    search(searchString: string): WMLQueryResult {
        return new WMLQueryResult(this, { search: searchString })
    }

    clone(): WMLQuery {
        return new WMLQuery(this.source)
    }

}

export class NewWMLQuery {
    onChange: (value: any) => void
    _source: string;
    _tokens: Token[] = [];
    _parse: ParseTag[] = [];
    _schema: SchemaTag[] = [];

    constructor(sourceString: string, options: WMLQueryOptions = {}) {
        const { onChange = () => {} } = options
        this.onChange = onChange
        this._source = sourceString
        this._tokens = tokenizer(new SourceStream(this.source))
        this.refresh()
    }

    get source(): string {
        return this._source
    }

    refresh(): void {
        this._parse = parse(this._tokens)
        this._schema = schemaFromParse(this._parse)
    }

    setInput(str: string): void {
        this._source = str
        this._tokens = tokenizer(new SourceStream(this.source))
        this.refresh()
        this.onChange({
            type: 'set',
            text: str,
            wmlQuery: this
        })
    }

    normalize(): NormalForm {
        return normalize(this._schema)
    }
    prettyPrint(): NewWMLQuery {
        // if (this.matcher.match().succeeded()) {
        //     const prettyPrinted = wmlSemantics(this.matcher.match()).prettyPrint
        //     this.matcher.setInput(prettyPrinted)
        // }
        return this
    }
    replaceInputRange(startIdx: number, endIdx: number, str: string): void {
        const newSource = `${this._source.slice(0, startIdx)}${str}${this._source.slice(endIdx)}`
        this._source = newSource
        //
        // TODO:  Use previous tokenizer results in recalculating tokens (earlier tokens are
        // unchanged, and once the tokens start matching after leaving the new section (if they do),
        // the new tokens are just index-shifted versions of the old)
        //
        this._tokens = tokenizer(new SourceStream(this.source))
        this.refresh()
        this.onChange({
            type: 'replace',
            startIdx,
            endIdx,
            text: str,
            wmlQuery: this
        })
    }

    search(search: string): NewWMLQueryResult {
        const parsedSearch = searchParse(searchTokenize(new SourceStream(search)))
        return new NewWMLQueryResult(this, { search: parsedSearch })
    }

    clone(): NewWMLQuery {
        return new NewWMLQuery(this.source)
    }

}
