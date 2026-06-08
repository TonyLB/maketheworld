import StandardFeature from './components/feature'
import StandardKnowledge from './components/knowledge'
import StandardRoom from './components/room'
import type { StandardComponent } from './components/baseClasses'

export const validateAssetWirePolicyForComponent = (component: StandardComponent): void => {
    if (component instanceof StandardRoom) {
        if (component.exits.length > 0) {
            throw new Error('Room exits are not allowed in asset mode')
        }
        if (component.objects.length > 0) {
            throw new Error('Room objects are not allowed in asset mode')
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
    }
}

export const validateAssetWirePolicy = (components: StandardComponent[]): void => {
    components.forEach(validateAssetWirePolicyForComponent)
}
