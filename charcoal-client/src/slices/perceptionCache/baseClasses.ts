import { EphemeraCharacterId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { PerceptionMessage } from '@tonylb/mtw-interfaces/ts/messages'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

export type PerceptionCacheKey = `${EphemeraCharacterId | 'ANONYMOUS'}::${string}`
export type PerceptionCacheState = Record<PerceptionCacheKey, PerceptionMessage & { parsedWML: StandardForm }>
