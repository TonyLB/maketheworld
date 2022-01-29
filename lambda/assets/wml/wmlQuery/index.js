import wmlGrammar from '../wmlGrammar/wml.ohm-bundle'

import { wmlSelectorFactory } from './selector'

export const wmlQueryFactory = (sourceString) => {
    let matcher = wmlGrammar.matcher()
    matcher.setInput(sourceString)
    let getReturnValue = () => (search) => ({
        nodes: () => ([]),
        source: () => (''),
        prop(key, value) {
            return ({
                nodes: () => ([]),
                source: () => ('')
            })
        },
        removeProp(key) {},
        contents: () => ([])
    })
    getReturnValue = () => (search) => ({
        nodes: () => {
            const match = matcher.match()
            if (match.succeeded()) {
                return wmlSelectorFactory(match)(search)
            }
            else {
                return []
            }
        },
        source: () => (matcher.getInput()),
        contents(value) {
            const match = matcher.match()
            if (value !== undefined) {
                if (match.succeeded()) {
                    const selected = wmlSelectorFactory(match)(search)
                    selected.forEach((node) => {
                        const { start, end } = (node.contents || []).reduce((previous, probeNode) => ({
                            start: Math.min(probeNode.start, previous.start),
                            end: Math.max(probeNode.end, previous.end)
                        }), { start: node.end, end: 0 })
                        if (end > 0) {
                            matcher.replaceInputRange(start, end, value)
                        }
                    })
                }
                return getReturnValue()(search)
            }
            else {
                if (match.succeeded()) {
                    const selected = wmlSelectorFactory(match)(search)
                    if (selected.length) {
                        return selected[0].contents || []
                    }
                }
                return []
            }
        },
        prop(key, value) {
            if (value !== undefined) {
                const match = matcher.match()
                if (match.succeeded()) {
                    const selected = wmlSelectorFactory(match)(search)
                    selected.forEach((node) => {
                        if (node.props[key]) {
                            const { valueStart, valueEnd } = node.props[key]
                            if (valueEnd) {
                                matcher.replaceInputRange(valueStart, valueEnd, value)
                            }
                        }
                    })
                }
                return getReturnValue()(search)
            }
            else {
                const match = matcher.match()
                if (match.succeeded()) {
                    const selected = wmlSelectorFactory(match)(search)
                    if (selected.length) {
                        return selected[0].props[key]?.value
                    }
                }
                return undefined
            }
        },
        removeProp(key) {
            const match = matcher.match()
            if (match.succeeded()) {
                const selected = wmlSelectorFactory(match)(search)
                selected.forEach((node) => {
                    if (node.props[key]) {
                        const { start, end } = node.props[key]
                        if (end) {
                            matcher.replaceInputRange(start-1, end, '')
                        }
                    }
                })
            }
            return getReturnValue()(search)
        }
    })
    return getReturnValue()
}