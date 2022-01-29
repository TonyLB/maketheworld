import wmlGrammar from '../wmlGrammar/wml.ohm-bundle'

import { wmlSelectorFactory } from './selector'

export const wmlQueryFactory = (sourceString) => {
    let matcher = wmlGrammar.matcher()
    matcher.setInput(sourceString)
    let getReturnValue = () => (search) => ({})
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
        source: () => (matcher.getInput())
    })
    return getReturnValue()
}