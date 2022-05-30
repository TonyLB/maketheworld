import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'

import { wmlSelectorFactory } from './selector.js'
import { validatedSchema, wmlSemantics } from '../index.js'
import { normalize } from '../normalize.js'

const renderFromNode = (normalForm) => ({ tag, type, value = '', props = {}, contents = [] }) => {
    switch(type) {
        case 'tag':
            const flattenedProps = Object.entries(props)
                .reduce((previous, [key, { value }]) => ({ ...previous, [key]: value }), {})
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
    constructor(wmlQuery, { search, extendsResult }) {
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

    refresh() {
        const match = this.wmlQuery.matcher.match()
        if (match.succeeded()) {
            this._nodes = this.search.reduce((previous, { search, not }) => {
                if (search) {
                    return wmlSelectorFactory(match, { currentNodes: previous })(search)
                }
                if (not) {
                    const excludeResults = new WMLQueryResult(this.wmlQuery, { search: not })
                    const excludeStarts = excludeResults.nodes().map(({ start }) => (start))
                    return (previous || []).filter(({ start }) => (!excludeStarts.includes(start)))
                }
            }, undefined) || []
        }
        else {
            this._nodes = []
        }
        if (this.extendsResult) {
            this.extendsResult.refresh()
        }
    }

    not(searchString) {
        this.search = [
            ...this.search,
            {
                not: searchString
            }
        ]
        this.refresh()
        return this
    }

    add(searchString) {
        this.search = [
            ...this.search,
            {
                search: searchString
            }
        ]
        this.refresh()
        return this
    }

    replaceInputRange(startIdx, endIdx, value) {
        this.wmlQuery.replaceInputRange(startIdx, endIdx, value)
    }

    get source() {
        return this.wmlQuery.source
    }

    nodes() {
        return this._nodes || []
    }

    get count() {
        return (this._nodes || []).count
    }

    expand() {
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

    addElement(source, options) {
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

    remove() {
        let offset = 0
        this._nodes.forEach(({ start, end }) => {
            this.replaceInputRange(start - offset, end - offset, '')
            offset += end - start
        })
        this.refresh()
        return this
    }

    children() {
        this._nodes = this._nodes.reduce((previous, { contents = [] }) => ([...previous, ...contents]), [])
        return this
    }

    prepend(sourceString) {
        if (this._nodes.length) {
            this.replaceInputRange(this._nodes[0].start, this._nodes[0].start, sourceString)
            this.refresh()
        }
        return this
    }

    prop(key, value, options = { type: 'literal' }) {
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
                    const insertAfter = Object.values(node.props || {})
                        .reduce((previous, { end }) => (Math.max(previous, end)), node.tagEnd)
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

    removeProp(key) {
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

    contents(value) {
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

    render(value) {
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

    prettyPrint() {
        this.wmlQuery.prettyPrint()
        this.refresh()
        return this
    }

    clone() {
        const newQuery = this.wmlQuery.clone()
        const newQueryResult = newQuery.search('')
        newQueryResult.search = this.search
        newQueryResult.refresh()
        return newQueryResult
    }

    extend() {
        return new WMLQueryResult(this.wmlQuery, { extendsResult: this })
    }

}

export class WMLQuery {
    constructor(sourceString, options = {}) {
        const { onChange = () => {} } = options
        this.onChange = onChange
        this.matcher = wmlGrammar.matcher()
        this.matcher.setInput(sourceString)
    }

    get source() {
        return this.matcher.getInput()
    }
    setInput(str) {
        this.matcher.setInput(str)
        this.onChange({
            type: 'set',
            text: str,
            wmlQuery: this
        })
    }
    normalize() {
        if (this.matcher.match().succeeded()) {
            const schema = validatedSchema(this.matcher.match())
            return normalize(schema)    
        }
        else {
            return {}
        }
    }
    prettyPrint() {
        if (this.matcher.match().succeeded()) {
            const prettyPrinted = wmlSemantics(this.matcher.match()).prettyPrint
            this.matcher.setInput(prettyPrinted)
        }
        return this
    }
    replaceInputRange(startIdx, endIdx, str) {
        this.matcher.replaceInputRange(startIdx, endIdx, str)
        this.onChange({
            type: 'replace',
            startIdx,
            endIdx,
            text: str,
            wmlQuery: this
        })
    }

    search(searchString) {
        return new WMLQueryResult(this, { search: searchString })
    }

    clone() {
        return new WMLQuery(this.source)
    }

}
