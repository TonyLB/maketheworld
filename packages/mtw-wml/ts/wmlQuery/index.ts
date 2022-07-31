import { NormalForm, ComponentRenderItem } from '../normalize'
import { Matcher } from 'ohm-js'

import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'

import { wmlSelectorFactory } from './selector.js'
import { schemaFromParse, validatedSchema, wmlSemantics } from '../index'
import { normalize } from '../normalize'
import parse from '../parser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'

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

    addElement(source: string, options: { position: 'before' | 'after' }): WMLQueryResult {
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

    prop(key: string, value: any, options: { type: 'literal' | 'boolean' | 'expression' } = { type: 'literal' }): WMLQueryResult | any {
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

    contents(value: any): WMLQueryResult | any[] {
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

    render(value: ComponentRenderItem[]): WMLQueryResult | ComponentRenderItem[] {
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
