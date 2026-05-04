import type { CoyoteNarrativeBeatsStructured } from '@tonylb/mtw-interfaces/ts/coyoteNarrativeBeatsStructured'
import { formatNarrativeBeatsStructuredForOutcomePrompt } from './formatPhasePlanForOutcomePrompt'
import { formatCoyoteStagedObjectsByRoom, type CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'
import type { CoyotePromptParts } from '../hypothesis/promptTypes'
import { COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES } from '../hypothesis/coyoteHypothesisPromptShared'

export type BuildPlanOutcomePromptInput = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    hypothesisLine: string
    walkthrough?: string
    narrativeBeatsStructured?: CoyoteNarrativeBeatsStructured
}

/**
 * Static instruction block (topology, safety, voice) for Bedrock prompt caching.
 * Does not include the trailing blank line before the dynamic tail.
 */
const INVARIANT_PLAN_OUTCOME_LINES = [
    'You are describing how a plan plays out in a classic Coyote-and-Road-Runner cartoon when it is executed.',
    '',
    'Your job is to narrate one concise outcome: what actually happens in cartoon',
    'physics when the Coyote\'s scheme runs.',
    '',
    ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    '',
    '## Hard constraints (safety and role)',
    '- The Road Runner must not be harmed, caught, trapped successfully, pinned, injured, or prevented from escaping.',
    '- Do not describe the Road Runner as defeated, outsmarted by the trap, or',
    '  suffering the intended consequence of the Coyote\'s plan.',
    '- Do not imply that the Coyote\'s trap "works" on the Road Runner.',
    '- The setback or punchline should land on the Coyote (Wile E.), not on the Road Runner.',
    '- Where you can, make the backfire feel poetic, ironic, or mechanically apt to',
    '  the staged props and rooms—classic cartoon karma.',
    '',
    '## Voice',
    '- Address the player in second person: "you" and "your", not "the player" or',
    '  "the Coyote" as a third-party lecture.',
    '- Describe the fictional execution in present or immediate story time, not as meta commentary about the game.',
    '- Respond with only one plain-text sentence or a very short plain-text',
    '  paragraph beginning exactly with "Outcome:".',
    '- No markdown fences, no JSON, no bullet lists, no numbered lists,',
    '  no extra commentary before or after the outcome line.',
] as const

const INVARIANT_PLAN_OUTCOME_PREFIX = INVARIANT_PLAN_OUTCOME_LINES.join('\n')

function buildPlanOutcomeDynamicLines(input: BuildPlanOutcomePromptInput): string[] {
    const snapshotSection = formatCoyoteStagedObjectsByRoom(input.roomObjectsByRoom)
    const hypothesisDisplay = input.hypothesisLine.trim() || '(none)'

    const lines: string[] = [
        '',
        '## Hypothesis line',
        hypothesisDisplay,
    ]

    const walkthrough = input.walkthrough?.trim()
    if (walkthrough) {
        lines.push(
            '',
            '## Cartoon play-by-play',
            walkthrough,
            '',
            '- The execution you describe should follow this analysis beat-for-beat in',
            '  cartoon time (fast, elastic, non-lethal cartoon physics).',
            '- Stay consistent with the hard constraints above: Road Runner safe, poetic or mechanical Coyote backfire.',
        )
    }

    if (input.narrativeBeatsStructured) {
        const outline = formatNarrativeBeatsStructuredForOutcomePrompt(
            input.narrativeBeatsStructured,
            input.roomObjectsByRoom
        )
        lines.push(
            '',
            '## Narrative beats structured (execution outline)',
            outline,
            '',
            '- Turn this ordered beat structure into a single Outcome: line. Follow',
            '  linearized beat order and walkthrough beats; the failure should still',
            '  be on the Coyote, with the Road Runner unharmed and free to escape.',
        )
    }

    lines.push('', '## Current staged objects by room', snapshotSection)
    return lines
}

/** Invariant topology/safety/voice prefix + dynamic hypothesis and snapshot, for Bedrock prompt caching. */
export function buildPlanOutcomePromptParts(input: BuildPlanOutcomePromptInput): CoyotePromptParts {
    const dynamicLines = buildPlanOutcomeDynamicLines(input)
    return {
        invariantPrefix: INVARIANT_PLAN_OUTCOME_PREFIX,
        dynamicSuffix: '\n' + dynamicLines.join('\n'),
    }
}

export function buildPlanOutcomePrompt(input: BuildPlanOutcomePromptInput): string {
    const { invariantPrefix, dynamicSuffix } = buildPlanOutcomePromptParts(input)
    return invariantPrefix + dynamicSuffix
}
