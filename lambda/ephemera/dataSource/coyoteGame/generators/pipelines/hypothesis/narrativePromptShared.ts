export const COMBINED_CLUSTERING_CONTRACT_LINES = [
    '## Combined clustering Markdown (how to read the dynamic tail)',
    '- After seam room labels you will see **## Combined trope candidates**, then one **### Candidate <id>** section per Stage One candidate.',
    '- Under each candidate you will see **executionSummary**, then one **#### <Trope>** section per assigned trope beat. Treat each trope section as candidate-local structure; do not merge trope sections across candidates.',
    '- Inside each trope section, **executionDetail** captures Stage One\'s first-draft beat detail. Member bullets list staged objects (**stableKey**, **shortName**, **room**). The later **## Plan selection grounding** block (not this section) may additionally list **synthetic** materialized affordance members (**`affordance:`** keys) from the winning handoff; those are not snapshot rows but are authoritative when present.',
    '- An indented line **tropeFunction:** is required for each **trope member** and describes that object\'s trope-local job inside this candidate. Use it as the canonical annotation for in-trope role/function intent.',
    '- Each candidate includes its own **#### Outliers** block (stableKey / shortName / room only). Outliers are candidate-local props not under any trope row; role language for them is not fixed in clustering --- do not move outlier props into trope sections unless the candidate already assigns them there.',
] as const

export const INTERPRETATION_RULES_LINES = [
    '## Interpretation rules',
    '- Address the player in second person, using "you" and "your", not "the player" or "the Coyote".',
    '- Assume the player is intelligent and intentional, even when the setup is absurd.',
    '- Prefer coherent cartoon-logic readings over random lists of props.',
    '- Never reinterpret Road Runner roles as Coyote gear-building instructions. For example, read **influence-road-runner** or **alter-road-runner** as effects on the Road Runner, not as constructive equipment prep for Coyote.',
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

export const TEMPORAL_ORDERING_LINES = [
    '## Temporal ordering (prep vs execution)',
    '- **Prep** (**prep** roles, assembly, bait placement, positioning): narrate these as finishing **before** the contraption fires, before a **trigger** releases the gag, or before the main cartoon beat lands --- not as simultaneous with the payoff.',
    '- **Creation** (**creation** roles): narrate generated or in-play effects as happening **during** execution of the plan / **during** the cartoon beat --- after setup has done its job.',
    '- Order your single **Hypothesis:** sentence so a reader can follow firing sequence and cause-and-effect: what leads off, what trips or delivers, what hits last. Lean on each member\'s **tropeFunction** annotation so beat order matches the candidate-local prop jobs.',
] as const

export const VIRTUAL_SCENERY_AND_PREP_OBJECTS_LINES = [
    '## Virtual scenery and prep-invented props',
    '- **Environmental scenery** from world topology and cartoon-opportunity cues is first-class in "## Scene analysis" and the **Hypothesis:** line even when it is not a separate staged **`Meta::Room.objects`** row: the cliff and boulder on **CLIFFTOP**, the rock face at **CORNER**, cacti along **STRAIGHTAWAY**, the chasm at **BRIDGE**, lever-friendly rocks, and similar fixed geography.',
    '- **Prep** may introduce narratively grounded **virtual** props or terrain (for example a painted fake tunnel on a rock face, a dug pit, piles, rigged ground rocks) that complete **before** the beat, consistent with **Temporal ordering** above. These are in-story setup, not new **`stableKey`** entries in the snapshot.',
    '- Still ground roles and membership on **## Combined clustering** and **## Outliers**; use virtual scenery to connect staged objects to place and sequence --- do not replace staged objects, merge outliers into clusters, or invent cluster members.',
] as const
