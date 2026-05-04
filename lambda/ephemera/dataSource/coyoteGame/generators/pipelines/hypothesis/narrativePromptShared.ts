export const INTERPRETATION_RULES_LINES = [
    '## Interpretation rules',
    '- Address the player in second person, using "you" and "your", not "the player" or "the Coyote".',
    '- Assume the player is intelligent and intentional, even when the setup is absurd.',
    '- Prefer coherent cartoon-logic readings over random lists of props.',
    '- Never reinterpret Road Runner roles as Coyote gear-building instructions. For example, read **influence-road-runner** or **alter-road-runner** as effects on the Road Runner, not as constructive equipment prep for Coyote.',
    '- Focus on what the committed maneuver makes happen to the Road Runner in cartoon time.',
    '- Choose the single most plausible detailed plan suggested by the staged objects and their room placement.',
    '- Do not use ambiguous either-or phrasing like "either ... or ...", "possibly", "maybe", or "perhaps".',
    '- Do not summarize the setup as a vague theme like "a chase" if the objects support a more specific trap or sequence.',
    '- Do not mention likely failure, backfire, irony, or the Coyote getting hurt.',
    '- The Hypothesis line must begin with "Hypothesis: It looks like ..." or "Hypothesis: It seems like ..." (intellectual humility in that opener only).',
    '- After that opener, write present-tense cartoon play-by-play in the same line: what you do first, next, then, as if the gag runs forward --- not hedging between beats and not restating plan-select engineering vocabulary.',
    '- Good style: "Hypothesis: It looks like you climb on top of the rocket. When the Road Runner speeds by, you light the fuse and launch in pursuit, arms out to grab him at last."',
    '- Bad style: "Hypothesis: It seems like you are trying to use the rocket and the straightaway to either chase or intercept the Road Runner."',
] as const

export const TEMPORAL_ORDERING_LINES = [
    '## Temporal ordering (prep vs execution)',
    '- **Prep** (**prep** roles, assembly, bait placement, positioning): narrate these as finishing **before** the contraption fires, before a **trigger** releases the gag, or before the main cartoon beat lands --- not as simultaneous with the payoff.',
    '- **Creation** (**creation** roles): narrate generated or in-play effects as happening **during** execution of the plan / **during** the cartoon beat --- after setup has done its job.',
    '- Order your **Hypothesis:** line and your **## Cartoon play-by-play** so a reader can follow firing sequence and cause-and-effect: what leads off, what trips or delivers, what hits last. Match the order implied by **`linearizedSequence`** in the scratchpad JSON.',
] as const

export const VIRTUAL_SCENERY_AND_PREP_OBJECTS_LINES = [
    '## Virtual scenery and prep-invented props',
    '- **Environmental scenery** from world topology and cartoon-opportunity cues is first-class in "## Cartoon play-by-play" and the **Hypothesis:** line even when it is not a separate staged **`Meta::Room.objects`** row: the cliff and boulder on **CLIFFTOP**, the rock face at **CORNER**, cacti along **STRAIGHTAWAY**, the chasm at **BRIDGE**, lever-friendly rocks, and similar fixed geography.',
    '- **Prep** may introduce narratively grounded **virtual** props or terrain (for example a painted fake tunnel on a rock face, a dug pit, piles, rigged ground rocks) that complete **before** the beat, consistent with **Temporal ordering** above. These are in-story setup, not new **`stableKey`** entries in the snapshot.',
    '- Still ground roles and membership on **## Committed plan** (including the **outliers** list under the selected candidate); use virtual scenery to connect staged objects to place and sequence --- do not replace staged objects, merge outliers into trope rows inappropriately, or invent members.',
] as const
