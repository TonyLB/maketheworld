import type { BuildHypothesisPromptInput, CoyotePromptParts } from '../promptTypes'
import type { CoyoteTrope } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { CANONICAL_TROPE_ORDER } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    coyoteSeamRoomMappingLines,
    splitCoyoteHypothesisLinesAtSnapshot,
} from '../coyoteHypothesisPromptShared'
import { serializeStagedObjectsAffinityForwardJson } from './serializeStagedObjectsForCandidatePrompt'

/** Stage-one snapshot heading (object-centric JSON); must match [`splitCoyoteHypothesisLinesAtSnapshot`] argument. */
export const CANDIDATE_STAGED_OBJECTS_SECTION_HEADER = '## Current staged objects'

const CANDIDATE_PROMPT_INTRO_LINES = [
    'You are clustering staged Acme objects in a Coyote-vs-Road-Runner cartoon setup.',
    '',
    'Reply with **valid JSON only**, following the contract below.',
    '- Do **not** write "Hypothesis:".',
    '- Do **not** use "## Scene analysis" -- that belongs to a later processing step.',
    '- Your entire response must be **one JSON object** (optional ```json fence).',
    '  No Markdown headings or prose outside JSON.',
    '- After any optional fence, the payload must start with **`{`** immediately.',
    '  Do **not** emit the bare word **`json`** before **`{`** (that is not valid JSON).',
] as const

const TROPE_ORDER: CoyoteTrope[] = CANONICAL_TROPE_ORDER
const TROPE_ORDER_LABEL = TROPE_ORDER.join(' -> ')

const CANDIDATE_TROPE_VOCABULARY_LINES = [
    '## Trope vocabulary',
    '- **Bait** (voluntary lure): Road Runner *chooses* a suboptimal stop or route (appetite, curiosity, desirable object).',
    '- **Misdirection** (illusion / perception): misread terrain or optics so motion lacks adequate control (fake tunnel, obscured vision); not the same as raw ability debuffs.',
    '- **Disadvantage**: impairment imposed independent of that choice or knowledge (sticky feet, net trap).',
    '- **Contraption**: setup machinery or capability deployed for the maneuver (rigs, launchers, prep hardware).',
    '- **Finishing Move**: terminal payoff or harm delivery aimed at the Road Runner.',
] as const

/** Few-shot: trope-first candidate assignments with required tropeFunction member annotations. */
const CANDIDATE_JSON_FEW_SHOT = `Example (shape -- use real **stableKey** strings from **Current staged objects** below):
\`\`\`json
{
  "candidates": [
    {
      "candidateId": "candidate-1",
      "executionSummary": "Road Runner stops at birdseed while rope-and-pulley rig drops an anvil overhead.",
      "tropeAssignments": {
        "Contraption": {
          "executionDetail": "Rope and pulley stage an overhead release path for the anvil.",
          "members": [
            { "stableKey": "rope", "tropeFunction": "hold things up" },
            { "stableKey": "pulley", "tropeFunction": "mechanical guide" }
          ]
        },
        "Bait": {
          "executionDetail": "Road Runner stops to eat a pile of birdseed.",
          "members": [{ "stableKey": "birdseed", "tropeFunction": "target zone bait" }]
        },
        "Finishing Move": {
          "executionDetail": "Anvil drops to flatten Road Runner at the bait point.",
          "members": [{ "stableKey": "anvil", "tropeFunction": "falling blunt trauma" }]
        }
      }
    },
    {
      "candidateId": "candidate-2",
      "executionSummary": "Road Runner stops at birdseed while rope, pulley, and anvil snap a snare trap shut.",
      "tropeAssignments": {
        "Contraption": {
          "executionDetail": "Rope and pulley rig a snare around birdseed, with anvil as counterweight release.",
          "members": [
            { "stableKey": "rope", "tropeFunction": "snare line" },
            { "stableKey": "pulley", "tropeFunction": "mechanical guide" },
            { "stableKey": "anvil", "tropeFunction": "counterweight" }
          ]
        },
        "Bait": {
          "executionDetail": "Road Runner stops to eat a pile of birdseed.",
          "members": [{ "stableKey": "birdseed", "tropeFunction": "target zone bait" }]
        }
      }
    }
  ],
  "notes": "Optional spatial note -- emit last."
}
\`\`\`

Second example (simple one-candidate shape):
\`\`\`json
{
  "candidates": [
    {
      "candidateId": "candidate-1",
      "executionSummary": "Use a rocket sled at the base of the cliff as a speed-chase contraption.",
      "tropeAssignments": {
        "Contraption": {
          "executionDetail": "Rocket sled launches from the cliff base to build immediate chase speed along the highway.",
          "members": [{ "stableKey": "rocket-sled", "tropeFunction": "speed rig" }]
        }
      }
    }
  ]
}
\`\`\`
`

const CANDIDATE_JSON_CONTRACT_LINES = [
    '## Stage one JSON contract',
    '- Root object keys (**emit in this order -- `candidates`, then optional `notes` last**):',
    '  - **`candidates`** (required non-empty array): each element is one complete',
    '    trope-first plan candidate. Each candidate object has:',
    '    - **`candidateId`** (required string): deterministic short id (for example',
    '      `candidate-1`, `candidate-2`).',
    '    - **`executionSummary`** (required non-empty string): one concise line for',
    '      the candidate\'s provisional execution.',
    '    - **`tropeAssignments`** (required non-empty object, not an array): sparse',
    `      record keyed by trope label in canonical order (**${TROPE_ORDER_LABEL}**).`,
    '      Include only trope keys used in that candidate. Valid keys are',
    '      `Contraption`, `Bait`, `Misdirection`, `Disadvantage`, `Finishing Move`.',
    '      Each trope-value object has:',
    '      - **`executionDetail`** (required non-empty string): first-draft detail',
    '        for how this trope beat runs in this candidate.',
    '      - **`members`** (required non-empty array): staged objects grouped to that',
    '        trope beat. Each member object has:',
    '      - **`stableKey`** (string): **literal copy** of the **`stableKey`** field',
    '        from **Current staged objects** (identify objects **only** by this',
    '        token -- never substitute **`shortName`** or room labels).',
    '      - **`tropeFunction`** (required non-empty string): very short trope-local',
    '        job phrase for that staged object in this candidate beat.',
    '    - **`outliers`** (optional array): for **your own partition reasoning** only. Each entry',
    '      is **`{ "stableKey": "<token>" }`** (literal staged **`stableKey`** only). The server',
    '      derives authoritative outliers from **`tropeAssignments`**; your list is not validated',
    '      against that derivation (include it to force explicit coverage thinking).',
    '  - **`notes`** (optional string, **last property in the root object**): at most',
    '    one short paragraph for spatial / cross-room context only',
    '    (no forward-looking plan narrative). Emit **`notes` after `candidates`**',
    '    so cross-room framing reflects the candidate assignments you already committed to.',
    '- **Trope-first candidate grouping only.** Assign props to trope beats for each',
    '  candidate; do not collapse multiple trope beats into one unlabeled cluster.',
    '- **Coverage per candidate:** Each staged **`stableKey`** appears **exactly once**',
    '  across candidate **`tropeAssignments.<trope>.members`** ∪ candidate **`outliers`**',
    '  (when candidate **`outliers`** is omitted, all keys appear in',
    '  **`tropeAssignments.<trope>.members`**).',
    '- **`tropeFunction` style (cost + speed):** use the shortest phrase that still',
    '  disambiguates intent --- usually **2-5 words**, lowercase fragment, not a full',
    '  sentence, no trailing punctuation.',
    '- Good: `"lane bait"`, `"drop trigger"`, `"boom payload"`.',
    '- Bad: `"terminal projectile payload delivery for final beat"`.',
    '- **Strict keys:** root object may contain only **`candidates`** and optional',
    '  **`notes`**. Candidate objects may contain only **`candidateId`**,',
    '  **`executionSummary`**, **`tropeAssignments`**, and optional **`outliers`**.',
    '  Each trope-value object may contain only **`executionDetail`** and **`members`**.',
    '  Each **member** object may contain only **`stableKey`** and required',
    '  **`tropeFunction`**. Each optional **outlier** object may contain only **`stableKey`**.',
    '- **Input evidence priority:** Use **`objects[*].tropeAffinities`** as the primary',
    '  decision signal when grouping members and writing **`tropeFunction`**; **`objects[*].room`** is execution context,',
    '  not the primary clustering axis.',
    '- Use **`decisionFocus.ambiguousStableKeys`** and **`decisionFocus.unassignedStableKeys`** as steering',
    '  for objects that warrant alternative readings vs props needing placement.',
    '- Treat optional **`environmentAffordances`** and **`affordancesProvided`** nested under each',
    '  affinity row as secondary advisory hints alongside primary **`tropeAffinities`** signals;',
    '  they can refine placement, but should not override stronger affinity evidence (both may appear',
    '  on the same row when justified).',
] as const

function candidatePromptLines(snapshotSection: string): string[] {
    return [
        ...CANDIDATE_PROMPT_INTRO_LINES,
        '',
        ...CANDIDATE_TROPE_VOCABULARY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
        '',
        ...CANDIDATE_JSON_CONTRACT_LINES,
        '',
        CANDIDATE_JSON_FEW_SHOT,
        '',
        CANDIDATE_STAGED_OBJECTS_SECTION_HEADER,
        'Use this JSON as authoritative staged-object input (`decisionFocus`, then `objects` rows with seam **`room`**, **`tropeAffinities`** including optional nested **`environmentAffordances`** and **`affordancesProvided`** when present).',
        '',
        '```json',
        snapshotSection || '{}',
        '```',
    ]
}

/** Stage 1 only: emits JSON clustering seam. Cache split before staged-objects snapshot. */
export function buildCandidatePrompt(input: BuildHypothesisPromptInput): CoyotePromptParts {
    const snapshotSection = serializeStagedObjectsAffinityForwardJson(input.roomObjectsByRoom)
    const lines = candidatePromptLines(snapshotSection)
    const splitAt = splitCoyoteHypothesisLinesAtSnapshot(lines, CANDIDATE_STAGED_OBJECTS_SECTION_HEADER)
    const mappingBlock = coyoteSeamRoomMappingLines(input.roomObjectsByRoom).join('\n')
    const tailAfterSplit = lines.slice(splitAt).join('\n')
    return {
        invariantPrefix: lines.slice(0, splitAt).join('\n'),
        dynamicSuffix: `\n${mappingBlock}\n\n${tailAfterSplit}`,
    }
}
