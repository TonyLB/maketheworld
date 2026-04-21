import type { CoyotePromptParts } from './buildHypothesisPrompt'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    coyoteSeamRoomMappingLines,
} from './coyoteHypothesisPromptShared'
import type { CoyoteRoomObjectsByRoom } from './coyoteRoomObjectSnapshot'

export type BuildHypothesisStageTwoPromptInput = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    /** Deterministic Markdown from combine + renderer (combined-only; no raw seam + snapshot replay). */
    combinedMarkdown: string
}

const STAGE_TWO_INTRO_LINES = [
    'You are completing the player-facing hypothesis for a Coyote-vs-Road-Runner cartoon setup.',
    '',
    'The dynamic section below contains **combined clustering input** (clusters, members, optional intended roles, outliers) derived from staged objects and Stage One --- use it as ground truth for grouping and roles.',
    '- Write a brief scene analysis under "## Scene analysis" for the player.',
    '- Then output exactly one plain-text line beginning with "Hypothesis:".',
    '- Structured markdown (including ## headings) is allowed only before the Hypothesis line; the Hypothesis line itself is plain text.',
] as const

const COMBINED_CLUSTERING_CONTRACT_LINES = [
    '## Combined clustering Markdown (how to read the dynamic tail)',
    '- After seam room labels you will see **## Combined clustering**, then one **### ClusterName** section per thematic group from Stage One. Treat each **###** heading as a working group for the maneuver; do not rename or merge clusters in your prose.',
    '- Each bullet under a cluster is one staged object: **stableKey**, **shortName**, and **room** (placement). An optional indented line **intendedRole:** is Stage One\'s binding choice of a single plan role for that object --- when present, prefer it over guessing from names.',
    '- **intendedRole** uses the plan-role vocabulary: structural **terminal**, **trigger**, **delivery**, **autonomous_agent**; generative **prep** and **creation**; and **entity_modification** with **target** (**coyote** / **road_runner** / **prop**) and **mode** (**direct** / **constructive**).',
    '- **prep** is setup that completes before the main trap fires or the cartoon beat runs; **creation** is effects that manifest during plan execution / the beat.',
    '- **## Outliers** lists staged objects in no **###** cluster. Acknowledge outliers when they matter to your reading; never fold them into a named cluster in prose. If outliers are **(none)**, do not invent cluster members.',
] as const

const INTERPRETATION_RULES_LINES = [
    '## Interpretation rules',
    '- Address the player in second person, using "you" and "your", not "the player" or "the Coyote".',
    '- Assume the player is intelligent and intentional, even when the setup is absurd.',
    '- Prefer coherent cartoon-logic readings over random lists of props.',
    '- Focus on what you think the player is trying to make happen to the Road Runner.',
    '- Choose the single most plausible detailed plan suggested by the staged objects and their room placement.',
    '- Do not use ambiguous either-or phrasing like "either ... or ...", "possibly", "maybe", or "perhaps".',
    '- Do not summarize the setup as a vague theme like "a chase" if the objects support a more specific trap or sequence.',
    '- Do not mention likely failure, backfire, irony, or the Coyote getting hurt.',
    '- Prefer phrasing like "Hypothesis: It looks like you are trying to ..." or "Hypothesis: It seems like you are trying to ...".',
    '- Uncertainty belongs only in that Hypothesis framing ("It looks like ..."). After it, narrate one committed plan in order, like a confident play-by-play - not another round of hedging.',
    '- Describe the chosen reading like sketching the perfect caper: a single ordered run through the geography and staged objects (what happens first, next, then), as if each step lands - not a survey of options and not hedging between beats.',
    '- Good style: "Hypothesis: It looks like you are trying to use the roller skates to build speed, then send the Road Runner into a rope-triggered rocket trap further down the straightaway."',
    '- Bad style: "Hypothesis: It seems like you are trying to set up a chase using the roller skates and the rocket and rope to either propel or trap the Road Runner."',
] as const

const SCENE_AND_HYPOTHESIS_LINES = [
    '## Scene analysis and Hypothesis output',
    '- Your "## Scene analysis" section should commit to a single reading and build the spatial and causal logic behind it. Do not survey multiple plans there; the Hypothesis restates that same reading as one sentence.',
    '- Ground your "## Scene analysis" section on the **combined clustering** block and world topology; narrate for the player without contradicting cluster membership, **## Outliers** listings, or stated intended roles.',
    '- After "## Scene analysis", respond with one plain-text sentence on its own line beginning exactly with "Hypothesis:".',
    '- No JSON. No extra commentary outside "## Scene analysis" (markdown allowed there) and the Hypothesis line.',
] as const

const EXTENDED_REASONING_VS_VISIBLE_TEXT_LINES = [
    '## Extended reasoning vs visible assistant text',
    '- This request may use **extended reasoning** in the model. Put **planning, ordering, and scratch work** in the **reasoning** channel --- not in the assistant **text** (**body**) stream.',
    '- Your **text** output must be **player-facing only**: optional "## Scene analysis" Markdown (per the rules above), then exactly one line beginning with **Hypothesis:** --- no chain-of-thought or scratch paragraphs **before** "## Scene analysis" in **text**. If reasoning is unavailable, keep **text** equally clean.',
] as const

const DYNAMIC_SECTION_INTRO = [
    '',
    'The following blocks are specific to this request (seam room labels, then combined clustering):',
    '',
    '## Combined clustering input (structured Markdown)',
] as const

/** Stage 2: topology + interpretation + scene/hypothesis rules invariant; dynamic tail = labels + combined Markdown only. */
export function buildHypothesisStageTwoPromptParts(input: BuildHypothesisStageTwoPromptInput): CoyotePromptParts {
    const seamRoomMappingBlock = coyoteSeamRoomMappingLines(input.roomObjectsByRoom).join('\n')
    const invariantPrefix = [
        ...STAGE_TWO_INTRO_LINES,
        '',
        ...COMBINED_CLUSTERING_CONTRACT_LINES,
        '',
        ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
        '',
        ...INTERPRETATION_RULES_LINES,
        '',
        ...SCENE_AND_HYPOTHESIS_LINES,
        '',
        ...EXTENDED_REASONING_VS_VISIBLE_TEXT_LINES,
        ...DYNAMIC_SECTION_INTRO,
    ].join('\n')

    const dynamicSuffix = [
        '',
        seamRoomMappingBlock,
        '',
        input.combinedMarkdown.trim(),
        '',
    ].join('\n')

    return {
        invariantPrefix,
        dynamicSuffix: `\n${dynamicSuffix}`,
    }
}
