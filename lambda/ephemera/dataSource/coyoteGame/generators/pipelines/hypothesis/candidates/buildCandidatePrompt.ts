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
    '- Do **not** use "## Scene analysis" or "## Cartoon play-by-play" -- those belong to a later processing step.',
    '- Your entire response must be **one JSON object** (optional ```json fence).',
    '  No Markdown headings or prose outside JSON.',
    '- After any optional fence, the payload must start with **`{`** immediately.',
    '  Do **not** emit the bare word **`json`** before **`{`** (that is not valid JSON).',
] as const

const TROPE_ORDER: CoyoteTrope[] = CANONICAL_TROPE_ORDER
const TROPE_ORDER_LABEL = TROPE_ORDER.join(' -> ')
const TROPE_VALID_KEYS_LABEL = TROPE_ORDER.map((t) => `\`${t}\``).join(', ')

const CANDIDATE_TROPE_VOCABULARY_LINES = [
    '## Trope vocabulary',
    '- **Scene Dressing** (narrative association): completes a visual or thematic scene without a causal mechanism; **`narrowing`** names an aesthetic or material **category** (e.g. `"racing gear"`, `"protective equipment"`) --- not a scenario or archetype label.',
    '- **Contraption**: setup machinery or capability deployed for the maneuver (rigs, launchers, prep hardware).',
    '- **Bait** (voluntary lure): Road Runner *chooses* a suboptimal stop or route (appetite, curiosity, desirable object).',
    '- **Misdirection** (illusion / perception): misread terrain or optics so motion lacks adequate control (fake tunnel, obscured vision); not the same as raw ability debuffs.',
    '- **Disadvantage**: impairment imposed independent of that choice or knowledge (sticky feet, net trap).',
    '- **Finishing Move**: terminal payoff or harm delivery aimed at the Road Runner.',
] as const

/**
 * Per-candidate orienting line for plan-select diversity; expressive space, not a fixed template.
 * Mechanics and staging stay in trope rows and executionSummary.
 */
const CANDIDATE_GIMMICK_GUIDANCE_LINES = [
    '## Gimmick (per candidate)',
    '- **`gimmick`** is **free-form orienting text**: it names how **this candidate reads as a distinct hypothesis** in the pool --- the through-line or payoff spine toward the Road Runner. **`executionSummary`** sketches **what happens**; **`tropeAssignments`** locks **props to tropes**; **`gimmick`** is only this row\'s **orienting headline** alongside those.',
    '- There is **no fixed grammatical mold** (token count, fragment vs phrase, tone). Stay **legible at a glance** next to **`executionSummary`**; **brevity is typical**, not a scoring rule --- vary density when it helps distinguish candidates.',
    '- **`gimmick`** voice is **pool-facing**: headline, hook, cluster shorthand, blunt label, or blended spine --- whatever **best telegraphs** this candidate\'s through-line to someone scanning the list.',
    '- **`gimmick`** stays at **through-line scope** --- your label for this hypothesis. **Rooms, staging, prop choreography, and beat mechanics** are **out of scope here**; develop them in **`tropeAssignments`** and **`executionSummary`** where each candidate is spelled out.',
    '- **Archetype clusters** pull attention (examples only --- not exhaustive, not mandatory labels): **delivered damage**, **high speed chase**, **unexpected approach**, **trap**. You may echo them, combine flavors, ignore them, or coin something else that fits the spine.',
    '- **Permission:** reuse wording like those clusters or like the few-shot **`gimmick`** strings **when they fit**; you are **not required** to invent novelty --- use a **different label** when it fits better.',
    '- Explore **different spines** across candidates (even unlikely ones) so the pool is not only trope permutations on the same idea.',
] as const

/** Core few-shot: shape + tropes; illustrative stableKeys only (not harness fixtures). */
const CANDIDATE_JSON_FEW_SHOT_CORE = `Example (**shape** --- few-shot **gimmick** strings are **samples**, not the only valid voices):
\`\`\`json
{
  "candidates": [
    {
      "candidateId": "candidate-1",
      "gimmick": "deliver damage",
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
      "gimmick": "snare trap",
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

Second example (Scene Dressing cluster + Contraption anchor --- illustrative stableKeys):
\`\`\`json
{
  "candidates": [
    {
      "candidateId": "candidate-1",
      "gimmick": "unexpected approach",
      "executionSummary": "Chemistry set stages a mad-science beat while lab coat and safety goggles complete the lab-scene dressing.",
      "tropeAssignments": {
        "Scene Dressing": {
          "executionDetail": "Lab coat and safety goggles signal scientific-apparatus and protective-equipment dressing around the rig.",
          "members": [
            { "stableKey": "lab-coat", "tropeFunction": "scientific apparel" },
            { "stableKey": "safety-goggles", "tropeFunction": "protective eyewear" }
          ]
        },
        "Contraption": {
          "executionDetail": "Chemistry set provides the mad-science rig for the beat spine.",
          "members": [{ "stableKey": "chemistry-set", "tropeFunction": "lab rig" }]
        }
      }
    }
  ]
}
\`\`\`
`

/** Iconic few-shot: genre-calibration samples aligned with harness fixtures; omit during harness candidate eval. */
// Mirrors fixture-01 / clean-001 and fixture-03; keep in sync with STAGE_ONE_GOLDEN_BY_FIXTURE_ID in coyoteEngineTestFixtures.
const CANDIDATE_JSON_FEW_SHOT_ICONIC = `Iconic genre examples (**calibration** --- use literal **stableKey** values from **Current staged objects** below, not these illustrative keys):

Scene Dressing chase (fixture-01 / clean-001):
\`\`\`json
{
  "candidates": [
    {
      "candidateId": "candidate-1",
      "gimmick": "high speed chase",
      "executionSummary": "Rocket skates anchor a chase while helmet and goggles complete the racing-scene dressing.",
      "tropeAssignments": {
        "Scene Dressing": {
          "executionDetail": "Helmet and goggles signal protective racing gear around the mobility anchor.",
          "members": [
            { "stableKey": "helmet-1", "tropeFunction": "protective gear" },
            { "stableKey": "goggles-2", "tropeFunction": "racing gear" }
          ]
        },
        "Contraption": {
          "executionDetail": "Rocket skates provide the pursuit-speed rig for the chase spine.",
          "members": [{ "stableKey": "rocket-skates-0", "tropeFunction": "speed rig" }]
        }
      }
    }
  ]
}
\`\`\`

Portable-hole finish (fixture-03):
\`\`\`json
{
  "candidates": [
    {
      "candidateId": "candidate-1",
      "gimmick": "hole trap",
      "executionSummary": "Paint and skates prep a route while birdseed lures into a portable-hole finish.",
      "tropeAssignments": {
        "Contraption": {
          "executionDetail": "Roller skates and paint prep speed and route illusion before commitment.",
          "members": [
            { "stableKey": "roller-skates-0", "tropeFunction": "speed rig" },
            { "stableKey": "paint-0", "tropeFunction": "route edit" }
          ]
        },
        "Bait": {
          "executionDetail": "Road Runner pauses for birdseed at the bridge approach.",
          "members": [{ "stableKey": "birdseed-1", "tropeFunction": "target bait" }]
        },
        "Finishing Move": {
          "executionDetail": "Portable hole is used as the terminal drop endpoint.",
          "members": [{ "stableKey": "portable-hole-0", "tropeFunction": "drop trap" }]
        }
      }
    }
  ]
}
\`\`\`
`

function candidateFewShotBlock(includeIconicFewShots: boolean): string {
    if (includeIconicFewShots) {
        return `${CANDIDATE_JSON_FEW_SHOT_CORE}\n\n${CANDIDATE_JSON_FEW_SHOT_ICONIC}`
    }
    return CANDIDATE_JSON_FEW_SHOT_CORE
}

const CANDIDATE_JSON_CONTRACT_LINES = [
    '## Stage one JSON contract',
    '- Root object keys (**emit in this order -- `candidates`, then optional `notes` last**):',
    '  - **`candidates`** (required non-empty array): each element is one complete',
    '    trope-first plan candidate. Each candidate object has:',
    '    - **`candidateId`** (required string): deterministic short id (for example',
    '      `candidate-1`, `candidate-2`).',
    '    - **`gimmick`** (required non-empty string): orienting through-line for this candidate (see **Gimmick** above);',
    '      **scannable** alongside **`executionSummary`**, not a duplicate of it; not constrained to **`tropeFunction`** style.',
    '    - **`executionSummary`** (required non-empty string): one concise line for',
    '      the candidate\'s provisional execution.',
    '    - **`tropeAssignments`** (required non-empty object, not an array): sparse',
    `      record keyed by trope label in canonical order (**${TROPE_ORDER_LABEL}**).`,
    `      Include only trope keys used in that candidate. Valid keys are ${TROPE_VALID_KEYS_LABEL}.`,
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
    '      - Optional **`environmentAffordances`** / **`affordancesProvided`** may be',
    '        included when strongly evidenced by staged input affinity rows.',
    '    - **`outliers`** (optional array): for **your own partition reasoning** only. Each entry',
    '      may include **`stableKey`** plus optional **`environmentAffordances`** /',
    '      **`affordancesProvided`** evidence arrays when present in staged inputs. The server',
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
    '- Do **not** repeat the same **`stableKey`** across multiple trope member rows in one candidate.',
    '  If one object supports multiple trope readings, choose the strongest single placement and',
    '  capture secondary nuance in that trope\'s **`executionDetail`** text.',
    '- **`tropeFunction` style (cost + speed):** use the shortest phrase that still',
    '  disambiguates intent --- usually **2-5 words**, lowercase fragment, not a full',
    '  sentence, no trailing punctuation.',
    '- Good: `"lane bait"`, `"drop trigger"`, `"boom payload"`.',
    '- Bad: `"terminal projectile payload delivery for final beat"`.',
    '- **Strict keys:** root object may contain only **`candidates`** and optional',
    '  **`notes`**. Candidate objects may contain only **`candidateId`**, **`gimmick`**,',
    '  **`executionSummary`**, **`tropeAssignments`**, and optional **`outliers`**.',
    '  Each trope-value object may contain only **`executionDetail`** and **`members`**.',
    '  Each **member** object may contain only **`stableKey`**, required',
    '  **`tropeFunction`**, and optional **`environmentAffordances`** / **`affordancesProvided`**.',
    '  Each optional **outlier** object may contain **`stableKey`** and optional',
    '  **`environmentAffordances`** / **`affordancesProvided`**.',
    '- **Input evidence priority:** Use **`objects[*].tropeAffinities`** as the primary',
    '  decision signal when grouping members and writing **`tropeFunction`**; **`objects[*].room`** is execution context,',
    '  not the primary clustering axis.',
    '- **`decisionFocus.anchorStableKeys`**: staged **`stableKey`**s that likely **ground** the candidate pool ---',
    '  treat these props as a **shared spine** across candidates unless another prop forces a twist.',
    '- **`decisionFocus.expanderStableKeys`**: staged **`stableKey`**s where you should **vary** candidates ---',
    '  multiple strong affinity readings, **Scene Dressing-only** archetype signal, and/or optional',
    '  **`environmentAffordances`** / **`affordancesProvided`** on non-Poor rows mean **different plausible hypotheses**',
    '  (different trope placements and/or treating optional affordances as **in play vs omitted** across candidates).',
    '  Each resolution can be its own candidate spine.',
    '- **Scene Dressing clustering:** props listed only under **`expanderStableKeys`** because their **only** non-Poor',
    '  fits are **Scene Dressing** support **archetype clustering** --- do **not** emit one thin candidate per dressing prop.',
    '  When several dressing props share **matching or compatible** narrowings (e.g. `"racing gear"` + `"protective equipment"`',
    '  around a causal anchor), prefer **one** candidate with a **`Scene Dressing`** trope row grouping those members and an',
    '  archetype-appropriate **`gimmick`** (e.g. `high speed chase`, `trap`, `unexpected approach`), with the anchor in **`Contraption`**.',
    '  **Scene Dressing** member rows do **not** carry **`environmentAffordances`** or **`affordancesProvided`**.',
    '- Optional **`environmentAffordances`** / **`affordancesProvided`** on **non-Poor causal** affinity rows are **branching axes**',
    '  where **`expanderStableKeys`** applies: explore alternatives rather than folding every hint into one story.',
    '  Still respect **`tropeAffinities`** as the primary trope-placement signal when those rows conflict.',
] as const

function candidatePromptLines(
    snapshotSection: string,
    options: { includeIconicFewShots: boolean }
): string[] {
    return [
        ...CANDIDATE_PROMPT_INTRO_LINES,
        '',
        ...CANDIDATE_TROPE_VOCABULARY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
        '',
        ...CANDIDATE_GIMMICK_GUIDANCE_LINES,
        '',
        ...CANDIDATE_JSON_CONTRACT_LINES,
        '',
        candidateFewShotBlock(options.includeIconicFewShots),
        '',
        CANDIDATE_STAGED_OBJECTS_SECTION_HEADER,
        'Use this JSON as authoritative staged-object input (`decisionFocus.anchorStableKeys` / `expanderStableKeys`, then `objects` rows with seam **`room`**, **`tropeAffinities`** including optional nested **`environmentAffordances`** and **`affordancesProvided`** when present).',
        '',
        '```json',
        snapshotSection || '{}',
        '```',
    ]
}

/** Stage 1 only: emits JSON clustering seam. Cache split before staged-objects snapshot. */
export function buildCandidatePrompt(input: BuildHypothesisPromptInput): CoyotePromptParts {
    const snapshotSection = serializeStagedObjectsAffinityForwardJson(input.roomObjectsByRoom)
    const includeIconicFewShots = input.includeIconicFewShots !== false
    const lines = candidatePromptLines(snapshotSection, { includeIconicFewShots })
    const splitAt = splitCoyoteHypothesisLinesAtSnapshot(lines, CANDIDATE_STAGED_OBJECTS_SECTION_HEADER)
    const mappingBlock = coyoteSeamRoomMappingLines(input.roomObjectsByRoom).join('\n')
    const tailAfterSplit = lines.slice(splitAt).join('\n')
    return {
        invariantPrefix: lines.slice(0, splitAt).join('\n'),
        dynamicSuffix: `\n${mappingBlock}\n\n${tailAfterSplit}`,
    }
}
