import StandardFeature from './components/feature'
import StandardKnowledge from './components/knowledge'
import StandardRoom from './components/room'
import StandardObject from './components/object'
import type { StandardComponent } from './components/baseClasses'

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
