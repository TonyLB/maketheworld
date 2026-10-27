import { EMBEDDING_CALIBRATION_IDENTITY_CASES } from '../../../../../../calibration/objectMatch/corpus'

import { SHORT_SPAN_LEXICAL_CASES } from './shortSpanCalibrationCases'

/**
 * The span and shortName pairs the lexical tests share (`AGENT.skeletonMatcher.planning.md`
 * Slice 4): the lexical tests' pairs, then every span against every catalog name of the
 * calibration corpus and the short-span cases. The aligner checks itself against Sellers on them.
 */
export const LEXICAL_PARITY_PAIRS: readonly (readonly [string, string])[] = [
    ['broom', 'broom'],
    ['broom', 'the broom'],
    ['the broom', 'broom'],
    ['broom', 'the extraordinarily detailed antique wooden broom'],
    ['sord', 'sword'],
    ['hyper-maceratr', 'hyper-macerator'],
    ['ax', 'rusty ax'],
    ['ax', 'rusty old ax'],
    ['ax', 'axle'],
    ['ax', 'sword'],
    ['ax', 'axolotl'],
    ['ax', 'coaxial'],
    ['sweeping tool', 'broom'],
    ['sword', 'anvil'],
    ['swrod', 'incredibly ornate jewel-encrusted sword'],
    ['cup on saucer on table', 'cup'],
    ['cup on saucer on kitchen table', 'kitchen table'],
    ['gem', 'gemstones'],
    ['don', 'wimbledon'],
    ...[...EMBEDDING_CALIBRATION_IDENTITY_CASES, ...SHORT_SPAN_LEXICAL_CASES]
        .flatMap(({ span, catalog }) => catalog.map((shortName) => [span, shortName] as const)),
]
