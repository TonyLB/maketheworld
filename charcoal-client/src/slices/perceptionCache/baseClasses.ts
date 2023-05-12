import { EphemeraCharacterId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { KnowledgeDescribeData } from '@tonylb/mtw-interfaces/dist/messages'

export type PerceptionCacheKey = `${EphemeraCharacterId | 'ANONYMOUS'}::${EphemeraKnowledgeId}`
export type PerceptionCacheState = Record<PerceptionCacheKey, KnowledgeDescribeData>
