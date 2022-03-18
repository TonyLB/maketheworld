import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'

import { wmlSelectorFactory } from './selector.js'
import { validatedSchema } from '../index.js'
import { normalize } from '../normalize.js'

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
}

export class WMLQuery {
    constructor(sourceString) {
        this.matcher = wmlGrammar.matcher()
        this.matcher.setInput(sourceString)
    }

    get source() {
        return this.matcher.getInput()
    }
    setInput(str) {
        this.matcher.setInput(str)
    }
    normalize() {
        const schema = validatedSchema(this.matcher.match())
        return normalize(schema)
    }
    replaceInputRange(startIdx, endIdx, str) {
        this.matcher.replaceInputRange(startIdx, endIdx, str)
    }

    search(searchString) {
        return new WMLQueryResult(this, searchString)
    }
}
