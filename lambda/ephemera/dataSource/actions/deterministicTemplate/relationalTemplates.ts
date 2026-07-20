import { makePatternTemplate, makeDeferPatternTemplate } from './patternTemplate'
import type { DeterministicTemplate } from './deterministicTemplate'

/**
 * Verb vocabulary mirrored from matchRelationalTemplate.ts's ESTABLISH_VERBS/
 * DISSOLVE_VERBS (source of truth for the relational verb split; not exported
 * there, so mirrored here rather than reaching into that module's internals).
 */
const ESTABLISH_VERBS = ['put', 'place', 'lean']
const DISSOLVE_VERBS = ['take', 'remove']

/**
 * Relation-phrase vocabulary mirrored from normalizeRelationSpan.ts's
 * ENUM_PHRASE_MAP/CONTAINMENT_PHRASES (source of truth). Longer phrases are
 * listed before their shorter substrings within each kind -- required, not
 * cosmetic: matchPatternAgainstString's regex alternation tries options
 * left-to-right and only needs *a* valid overall match, not the longest one.
 * If a shorter phrase came first, the preceding non-greedy objectSpan capture
 * could swallow part of a longer phrase instead (e.g. "leaning" bleeding into
 * the subject span of "put lamp leaning against wall").
 */
const AGAINST_PHRASES = ['leaning against', 'lean against', 'against']
const UNDER_PHRASES = ['underneath', 'beneath', 'under']
const ON_PHRASES = ['on top of', 'onto', 'on']
const CONTAINMENT_PHRASES = ['in', 'inside', 'into']

/**
 * Every relational template shares this constant: no verbClass/operationKind/
 * relationKind at classify time here either, mirroring ParseCommandObjectRelateIntentResult's
 * existing minimal shape (confirmed: nothing downstream reads more than
 * type/confidence off it). Differentiation -- which verb, which relation
 * phrase, subject/target spans -- lives entirely in the synthesized skeleton,
 * recoverable downstream the same way matchRelationalTemplate.ts already
 * recovers it from a Parse-produced skeleton. subject/target/relationLabel
 * role-tagged captures still merge onto the returned intent as inert extra
 * fields via the generic combinator (same structural-trust pattern Step 1
 * already shipped for ObjectMembershipIntent+subject).
 */
const RELATE_INTENT = { type: 'ObjectRelateIntent' as const, confidence: 1 as const }

function makeEnumTemplate(verbOptions: string[], prepOptions: string[]): DeterministicTemplate {
    return makePatternTemplate(
        [
            { type: 'templateText', options: verbOptions },
            { type: 'objectSpan', role: 'subject' },
            { type: 'templateText', options: prepOptions },
            { type: 'objectSpan', role: 'target' },
        ],
        RELATE_INTENT
    )
}

function makeCustomTemplate(verbOptions: string[]): DeterministicTemplate {
    return makePatternTemplate(
        [
            { type: 'templateText', options: verbOptions },
            { type: 'objectSpan', role: 'subject' },
            { type: 'capturedText', role: 'relationLabel' },
            { type: 'objectSpan', role: 'target' },
        ],
        RELATE_INTENT
    )
}

/**
 * Containment language ("in"/"inside"/"into") is a recognized-but-unsupported
 * shape, not an ambiguous one: the current relation model (On/Under/Against/
 * Custom, a positionGraph edge) has no representation for object-containment
 * at all. Any string that structurally matches this shape always defers --
 * normalizeRelationSpan.ts already treats this exact phrase set as
 * nestingDefer for the post-Parse path.
 */
function makeContainmentTemplate(verbOptions: string[]): DeterministicTemplate {
    return makeDeferPatternTemplate(
        [
            { type: 'templateText', options: verbOptions },
            { type: 'objectSpan', role: 'subject' },
            { type: 'templateText', options: CONTAINMENT_PHRASES },
            { type: 'objectSpan', role: 'target' },
        ],
        'nesting'
    )
}

export const establishAgainstTemplate = makeEnumTemplate(ESTABLISH_VERBS, AGAINST_PHRASES)
export const establishUnderTemplate = makeEnumTemplate(ESTABLISH_VERBS, UNDER_PHRASES)
export const establishOnTemplate = makeEnumTemplate(ESTABLISH_VERBS, ON_PHRASES)
export const dissolveAgainstTemplate = makeEnumTemplate(DISSOLVE_VERBS, AGAINST_PHRASES)
export const dissolveUnderTemplate = makeEnumTemplate(DISSOLVE_VERBS, UNDER_PHRASES)
export const dissolveOnTemplate = makeEnumTemplate(DISSOLVE_VERBS, ON_PHRASES)

export const establishContainmentTemplate = makeContainmentTemplate(ESTABLISH_VERBS)
export const dissolveContainmentTemplate = makeContainmentTemplate(DISSOLVE_VERBS)

export const establishCustomTemplate = makeCustomTemplate(ESTABLISH_VERBS)
export const dissolveCustomTemplate = makeCustomTemplate(DISSOLVE_VERBS)

/**
 * Registration order matters: capturedText in the custom templates accepts
 * any text, so it would shadow the enum/containment templates for the same
 * verb-class if it ran first (they'd never be reached). Enum rows and the
 * containment row for a verb-class must precede that verb-class's custom
 * row.
 */
export const relationalTemplateRegistry: DeterministicTemplate[] = [
    establishAgainstTemplate,
    establishUnderTemplate,
    establishOnTemplate,
    establishContainmentTemplate,
    establishCustomTemplate,
    dissolveAgainstTemplate,
    dissolveUnderTemplate,
    dissolveOnTemplate,
    dissolveContainmentTemplate,
    dissolveCustomTemplate,
]
