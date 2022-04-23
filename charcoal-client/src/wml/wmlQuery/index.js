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
    constructor(wmlQuery, search) {
        this.wmlQuery = wmlQuery
        this.search = [{
            search
        }]
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
                    const excludeResults = new WMLQueryResult(this.wmlQuery, not)
                    const excludeStarts = excludeResults.nodes().map(({ start }) => (start))
                    return (previous || []).filter(({ start }) => (!excludeStarts.includes(start)))
                }
            }, undefined) || []
        }
        else {
            this._nodes = []
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
                    const { valueStart, valueEnd } = node.props[key]
                    if (valueEnd) {
                        this.replaceInputRange(valueStart, valueEnd, value)
                    }
                }
                else {
                    const insertAfter = Object.values(node.props || {})
                        .reduce((previous, { end }) => (Math.max(previous, end)), node.tagEnd)
                    const newProp = type === 'boolean'
                        ? `${key}`
                        : type === 'expression'
                            ? `${key}={${value}}`
                            : `${key}="${value}"`
                    this.replaceInputRange(insertAfter, insertAfter, ` ${newProp}`)
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
        if (value !== undefined) {
            this._nodes.forEach((node) => {
                const { start, end } = (node.contents || []).reduce((previous, probeNode) => ({
                    start: Math.min(probeNode.start, previous.start),
                    end: Math.max(probeNode.end, previous.end)
                }), { start: node.end, end: 0 })
                if (end > 0) {
                    this.replaceInputRange(start, end, value)
                }
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
                        return `<Link key=(${item.key}) to=(${item.to})>${item.text}</Link>`
                    case 'String':
                        return item.value
                }
            })
            const revisedContents = renderContents.join("\n")
            let offset = 0
            this._nodes.forEach((node) => {
                //
                // Calculate the entire span being filled with contents
                //
                const { start, end } = (node.contents || []).reduce((previous, probeNode) => ({
                    start: Math.min(probeNode.start, previous.start),
                    end: Math.max(probeNode.end, previous.end)
                }), { start: node.end, end: 0 })
                if (end > 0) {
                    this.replaceInputRange(start+offset, end+offset, revisedContents)
                    offset += revisedContents.length - (end - start)
                }
            })
            this.refresh()
            return this
        }
        else {
            if (this._nodes.length && ['Room', 'Feature'].includes(this._nodes[0].tag)) {
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
        const schema = validatedSchema(this.matcher.match())
        return normalize(schema)
    }
    prettyPrint() {
        const prettyPrinted = wmlSemantics(this.matcher.match()).prettyPrint
        this.matcher.setInput(prettyPrinted)
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
        return new WMLQueryResult(this, searchString)
    }
}
