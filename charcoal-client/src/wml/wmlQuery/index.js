import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'

import { wmlSelectorFactory } from './selector.js'
import { validatedSchema } from '../index.js'
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
        this.search = search
        this.refresh()
    }

    refresh() {
        const match = this.wmlQuery.matcher.match()
        if (match.succeeded()) {
            this._nodes = wmlSelectorFactory(match)(this.search)
        }
        else {
            this._nodes = []
        }
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

    prop(key, value) {
        if (value !== undefined) {
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
                    this.replaceInputRange(insertAfter, insertAfter, ` ${key}="${value}"`)
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
                if (typeof item === 'object') {
                    return `<Link key=(${item.key}) to=(${item.to})>${item.text}</Link>`
                }
                else {
                    return item
                }
            })
            this._nodes.forEach((node) => {
                //
                // Generate new contents, replacing current render elements with new
                //
                const nonRenderNodes = node.contents.filter(({ type, tag }) => (type === 'tag' && tag !== 'Link'))

                const reApplyNonRenderContents = nonRenderNodes.map(({ start, end }) => (this.source.substring(start, end)))
                const revisedContents = [
                    ...renderContents,
                    ...reApplyNonRenderContents
                ].join("\n")
                //
                // Calculate the entire span being filled with contents
                //
                const { start, end } = (node.contents || []).reduce((previous, probeNode) => ({
                    start: Math.min(probeNode.start, previous.start),
                    end: Math.max(probeNode.end, previous.end)
                }), { start: node.end, end: 0 })
                if (end > 0) {
                    this.replaceInputRange(start, end, revisedContents)
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
