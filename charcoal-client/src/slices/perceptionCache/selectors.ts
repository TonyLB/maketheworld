import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { Selector } from '../../store'
import { PerceptionCacheKey } from './baseClasses'
import { EphemeraCharacterId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { PerceptionMessage } from '@tonylb/mtw-interfaces/ts/messages'

export const getCachedPerception = ({ CharacterId, EphemeraId }: { CharacterId?: EphemeraCharacterId, EphemeraId: EphemeraKnowledgeId }): Selector<{ fetched: boolean, wmlContent: string, parsedWML?: StandardForm, componentUUID?: ComponentUUID, Target?: PerceptionMessage['Target'] }> => (state) => {
    const cacheKey: PerceptionCacheKey = `${ CharacterId ?? 'ANONYMOUS' }::${EphemeraId}`
    if (cacheKey in state.perceptionCache) {
        const cachedMessage = state.perceptionCache[cacheKey]
        return {
            fetched: true,
            wmlContent: cachedMessage.wmlContent,
            parsedWML: cachedMessage.parsedWML,
            componentUUID: cachedMessage.metaData.componentUUID,
            Target: cachedMessage.Target
        }
    }
    else {
        return {
            fetched: false,
            wmlContent: `<Asset key=(empty) />`
        }
    }
}
