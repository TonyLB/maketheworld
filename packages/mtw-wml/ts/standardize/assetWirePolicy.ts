import StandardFeature from './components/feature'
import StandardKnowledge from './components/knowledge'
import StandardRoom from './components/room'
import StandardObject from './components/object'
import StandardConcept from './components/concept'
import type { StandardComponent } from './components/baseClasses'

/**
 * Concepts share LG-7's unsettled questions (dynamic Ephemera versus the authored baseline), so
 * every authored Concept membership is held back the same way. The WML structures parse in every
 * mode; this is the single seam that lifts, replaced by whatever mechanism settles LG-7.
 */
const conceptGateMessage = (what: string): string => (
    `${what} are intended but unbuilt -- blocked pending recache reconciliation (identity across asset-stack merge and across recache). Concepts share the Object gate. See standardize/AGENT.md, Asset wire policy section, LG-7.`
)

export const validateAssetWirePolicyForComponent = (component: StandardComponent): void => {
    if (component instanceof StandardRoom) {
        if (component.exits.length > 0) {
            throw new Error('Room exits are not allowed in asset mode')
        }
        if (component.ludicGraph.nodesByTag('Object').payload.length > 0) {
            throw new Error(
                'Authored objects in rooms are intended but unbuilt -- blocked pending recache reconciliation (identity across asset-stack merge and across recache). See standardize/AGENT.md, Asset wire policy section, LG-7.'
            )
        }
        if (component.ludicGraph.nodesByTag('Concept').payload.length > 0) {
            throw new Error(conceptGateMessage('Authored concepts in rooms'))
        }
        if (component.render !== undefined) {
            throw new Error('Room render is not allowed in asset mode')
        }
        return
    }
    if (component instanceof StandardFeature) {
        if (component.render !== undefined) {
            throw new Error('Feature render is not allowed in asset mode')
        }
        return
    }
    if (component instanceof StandardKnowledge) {
        if (component.render !== undefined) {
            throw new Error('Knowledge render is not allowed in asset mode')
        }
        return
    }
    if (component instanceof StandardConcept) {
        if (component.ludicGraph.nodesByTag('Object').payload.length > 0) {
            throw new Error(conceptGateMessage('Authored objects in concepts'))
        }
        if (component.ludicGraph.nodesByTag('Concept').payload.length > 0) {
            throw new Error(conceptGateMessage('Authored concepts in concepts'))
        }
        return
    }
    if (component instanceof StandardObject) {
        if (component.render !== undefined) {
            throw new Error('Object render is not allowed in asset mode')
        }
        return
    }
}

export const validateAssetWirePolicy = (components: StandardComponent[]): void => {
    components.forEach(validateAssetWirePolicyForComponent)
}
