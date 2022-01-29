import wmlGrammar from '../wmlGrammar/wml.ohm-bundle'

import { wmlSelectorFactory } from './selector'

export const wmlQueryFactory = (sourceString) => {
    let matcher = wmlGrammar.matcher()
    matcher.setInput(sourceString)
    let getReturnValue = () => (search) => ({
        nodes: () => ([]),
        source: () => (''),
        prop(key) {
            return undefined
        }
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
        prop(key) {
            const match = matcher.match()
            if (match.succeeded()) {
                const selected = wmlSelectorFactory(match)(search)
                if (selected.length) {
                    return selected[0].node.props[key]
                }
            }
            return undefined
        }
    })
    return getReturnValue()
}