import { Selector } from '../../store'
import { PerceptionCacheKey } from './baseClasses'
import { EphemeraCharacterId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { KnowledgeDescribeData } from '@tonylb/mtw-interfaces/dist/messages'

export const getCachedPerception = ({ CharacterId, EphemeraId }: { CharacterId?: EphemeraCharacterId, EphemeraId: EphemeraKnowledgeId }): Selector<KnowledgeDescribeData & { fetched: boolean }> => (state) => {
    const cacheKey: PerceptionCacheKey = `${ CharacterId ?? 'ANONYMOUS' }::${EphemeraId}`
    if (cacheKey in state.perceptionCache) {
        return {
            ...state.perceptionCache[cacheKey],
            fetched: true
        }
    }
    else {
        return {
            Description: [],
            Name: [],
            KnowledgeId: EphemeraId,
            fetched: false
        }
    }

}
