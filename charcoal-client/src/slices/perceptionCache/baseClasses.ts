import { EphemeraCharacterId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { KnowledgeDescribeData } from '@tonylb/mtw-interfaces/ts/messages'

export type PerceptionCacheKey = `${EphemeraCharacterId | 'ANONYMOUS'}::${EphemeraKnowledgeId}`
export type PerceptionCacheState = Record<PerceptionCacheKey, KnowledgeDescribeData>
