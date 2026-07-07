import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogEntry, ObjectManipulationCatalogScope } from '../catalogMerge'

/**
 * Pure embedding identity fast path (EM-0 scaffold).
 * May import calibration/objectMatch/corpus types only --- not handler wiring or Bedrock.
 */

export type EmbeddingMatchAbstainReason =
    | 'below_floor'
    | 'ambiguous_margin'
    | 'no_eligible_embeddings'
    | 'embed_invoke_failed'

export type EmbeddingMatchCandidate = ObjectManipulationCatalogEntry & {
    embedding?: SemanticEmbedding
}

export type EmbeddingMatchRankedScore = {
    objectId: EphemeraObjectId
    catalogScope: ObjectManipulationCatalogScope
    similarity: number
}

export type EmbeddingMatchDecision =
    | {
          type: 'Resolved'
          objectId: EphemeraObjectId
          catalogScope: ObjectManipulationCatalogScope
      }
    | {
          type: 'Abstain'
          reason: EmbeddingMatchAbstainReason
      }
