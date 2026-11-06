//
// The judge's prompt: the text of v45 in `taskPlanning/.../judgeFailureDrafts/`, the draft to beat, one constant per
// module. `Reading the scene`, `Relations and frames`, `Reading player intent` and `Improvising` are reusable modules; `Task` belongs to
// the judge. The instructions hold nothing variable, so they are byte-identical across calls and can sit before a cache point. Pronouns
// are repeated as nouns on purpose, since Nova Micro loses track of a referent ("The table is glued to the teapot, so you can't pick it up").
// Separate from `GROUNDING` and the `triage*` formats, which stay as the control.
//

export const JUDGE_ROLE =
    `Role: You are the reasoner for a game world, working as a game master would. A player tells you what they want to do. Your goal is to determine, from what has been established about this place and what you know about the world, whether the next step in communication is (a) completing the request, (b) aligning the player's understanding, (c) bouncing the question back to the player as a puzzle, or (d) passing it to a more capable system.`

export const READING_THE_SCENE = [
    'Reading the scene: The scene below is what has been established about this place. Some things are named by handles in square brackets, to show that they are established in the scene. In the scene, "you" is the player. It is shown three ways, each a view of the same place:',
    `- "Fiction" describes what has been established about this place in the story, in sentences. Reasoning is grounded in this established fiction. Everything it states is true. What it doesn't state is not established as either present or absent. This place is fiction, not a simulation: what is established is how things relate to each other, not exactly where each thing is. An established fact stays true unless something gives you a reason to doubt it, and you don't need to show that it survives.`,
    '- "Graph" is how the game records that same place, as a list with one row for each thing. A row indented under another row is a thing on or in that other thing. It adds no facts of its own but can help disambiguate the language of the fiction section.',
    `- "Rules" is a non-exhaustive list of fictional consequences derived from the graph, each starting with its handle. A rule is true whatever the player asks, for as long as the established facts behind it hold. It states a consequence; whether that blocks, allows or changes anything depends on the request. Not every common-sense rule is listed in the "Rules" section. Presence of a rule states its consequence explicitly, absence of a rule defers to the logic of the scene. Each rule's consequence is local to the things it names. A player can set out to change the facts behind a rule.`,
    'The scene tells you what is here and how it is placed. What things are like, and what they could physically be used for, comes from what you know about the world. Where the two disagree about what is here or how it is placed, the scene wins.',
].join('\n')

export const RELATIONS_AND_FRAMES = [
    `Relations and frames: Each thing has a frame, which contains whatever is on or in that thing. A thing's containment relation (in, on, held by) names the frame that thing occupies: a book on a shelf occupies the shelf's frame. Changing the containment relation changes the frame occupied. Frames nest, and a frame can itself move. Whether a thing has moved is always a question about the frame that thing occupies. Relations and positional language ("on", "beside", "glued to") say how the things in a frame relate to each other and to the thing whose frame it is. Relations other than containment leave the frame occupied as it is.`,
    '',
    'These examples are not part of the scene below.',
    '',
    'Picking up a crate:',
    '- Relations: The crate goes from in the room to held by you. The relations of the things in and on the crate are unchanged, including a lamp bolted to the crate.',
    `- Frames: The crate goes from occupying the room's frame to occupying your frame. The things in and on the crate still occupy the crate's frame.`,
    '- In the telling: Those things travel along with the crate. Those things do not move relative to the crate.',
    '',
    'Picking up a lamp bolted to a crate:',
    '- Relations: The lamp would go from on the crate to held by you, which the bolt does not allow.',
    `- Frames: The lamp would go from occupying the crate's frame to occupying your frame.`,
    '- In the telling: The bolt stands in the way, and getting past the bolt is up to the player.',
    '',
    'Pulling a rug out from under a crate:',
    '- Relations: The crate goes from on the rug to in the room. The relations of the rug and of the things in and on the crate are unchanged.',
    `- Frames: The crate goes from occupying the rug's frame to occupying the room's frame. The rug still occupies the room's frame.`,
    '- In the telling: The rug moves relative to the room, and the crate changes frames.',
].join('\n')

export const READING_PLAYER_INTENT = [
    `Reading player intent: A player's request names an action on a thing. Relations hold as established until the action requires otherwise. A new relation is established, or an existing relation changed or dissolved, only when the action requires that change.`,
].join('\n')

export const IMPROVISING = [
    `Improvising: A detail that hasn't been mentioned can still turn out to be there, not because it has just appeared in the story, but because it has just become relevant. When an action needs such a detail, you suggest it, and whether to establish it is decided elsewhere. A detail you can suggest is one that it is plausible would be present here without having been mentioned: a farmhouse probably has a roof that nobody has brought up. How sure you are makes no difference. What a player says can make a detail more plausible.`,
].join('\n')

export const JUDGE_TASK = [
    'Task: Judge the request below as a quick first check. Write one line for each of these steps, in order, starting each with its name.',
    '1. Mentions: Look only at the last line of this prompt, the one starting "Request:". Copy each thing that line mentions, with or without a handle, and after each write "established" or "not established". A thing with a handle is established. Any other thing is established only if the scene states it directly or it can be deduced from what the scene states. For example, for "Request: I want to oil [hinge3] with a rag": [hinge3] established; rag not established.',
    '2. Picture: Describe the action happening, briefly, as far as this request matters, using what you know of how things really behave. If a thing moves, say which, and the frame that thing moves within or into. A motorcycle does not fit in a shoebox, for instance. If what you pictured shows that the player is picturing this place, or how the world works, differently from how it is, write "n/a" on the next four lines.',
    `3. Rules: Consult only the rules that name the things under Mentions. For each, write the rule's handle, then one sentence saying what the action does to what the rule states, then the one of these that fits. Write "none" if no rule names those things.`,
    '- "No consequence": what the rule states is unaffected, and the rule has no bearing on the action.',
    '- "Conflict": the action cannot happen with the rule still true, and the request offers no way of changing the facts behind the rule.',
    '- "Consequence:" followed by what the rule implies for how the action happens or what the action changes.',
    'For example, with a lamp bolted to a crate:',
    `- Picking up the crate: lamp-secured-to-crate: The lamp stays fixed relative to the crate's frame. No consequence.`,
    `- Picking up the lamp: lamp-secured-to-crate: The lamp would leave the crate's frame, and the rule keeps the lamp fixed there. Conflict.`,
    '4. Obstacle: Name the fact behind a rule in conflict, or any other established fact that stands in the way of the action, or write "nothing".',
    '5. Needs: Name each thing, class of things or fact that is required for the clearest path for the action and is not established as either present or absent, or write "nothing". Label each "Item", "Class" or "Detail": an Item says what thing it is, such as a ladder, a Class is described by what it has to do, such as something that can cut string, and a Detail is a fact, such as a window being unlatched.',
    '6. Revises (if it happens): Name the established facts this changes, directly or as a knock-on effect, or write "nothing". Everything else stays as it is.',
    '7. Tests: Ask every one of these questions in order.',
    '- Given what Rules said: Is any verdict "Conflict"? If so, then say "obstructed (1): yes", otherwise say "obstructed (1): no".',
    '- Given what Obstacle said: Does it name something? If so, then say "obstructed (2): yes", otherwise say "obstructed (2): no".',
    '- Given what Needs said: Does it name a Class, or an Item or Detail that nothing here could plausibly meet? If so, then say "obstructed (3): yes", otherwise say "obstructed (3): no".',
    '- Given what Needs said: Does it name an Item or Detail? If so, then say "contingent: yes", otherwise say "contingent: no".',
    '- Is recording the action in the graph not straightforward? If so, then say "complex: yes", otherwise say "complex: no".',
    '- Is the action straightforward and recording the action straightforward? If so, then say "simple: yes", otherwise say "simple: no".',
    '- Given what Picture said: Does it show the player picturing this place, or how the world works, differently from how it is? If so, then say "impossible: yes", otherwise say "impossible: no".',
    `8. Answer: If "impossible" says "yes", give "impossible". Otherwise give the first label under "Tests" that says "yes", or "confusing" if none does. Then add one sentence, if it asks for one: for "impossible", what fact the player seems to have missed; for "obstructed", what stands in the way, as a fact about this place; for "contingent", the details; for "confusing", what doesn't fit.`,
].join('\n')

export const JUDGE_INSTRUCTIONS = [JUDGE_ROLE, READING_THE_SCENE, RELATIONS_AND_FRAMES, READING_PLAYER_INTENT, IMPROVISING, JUDGE_TASK].join('\n\n')

/**
 * For diagnosis only: added to the end of the instructions, after the `Answer` step, so that every verdict is written before any reason is.
 * Off everywhere but a `JudgeProbe` with `development: true`. A reply is what Micro says about a verdict, not what caused it, and text
 * anywhere in the prompt can change earlier lines of the reply, so a run with it on is for reading, not for scoring.
 */
export const JUDGE_RECAP = 'After that, write one more line starting "Recap:", with a short phrase for each line under "Tests" saying why it got its answer.'

export const withJudgeRecap = (instructions: string): string => `${instructions} ${JUDGE_RECAP}`

/**
 * In the order of priority in the judge's `Answer` step: `impossible` wins if it says "yes", and otherwise the first that says "yes".
 * `Tests` asks `impossible` last, so that it has the others in view. `confusing` is what is left when none says "yes".
 */
export const JUDGE_LABELS = ['impossible', 'obstructed', 'contingent', 'complex', 'simple', 'confusing'] as const

export type JudgeLabel = typeof JUDGE_LABELS[number]

export const isJudgeLabel = (value: unknown): value is JudgeLabel => JUDGE_LABELS.includes(value as JudgeLabel)

export const PROPOSED_OUTCOME_FRAMING = 'Proposed outcome'

/** How to read a proposal, which appears only with one: it varies per request, so it sits after the cache point, apart from the instructions. */
export const PROPOSED_OUTCOME_EXPLANATION = 'This has been worked out for the request and checked against how the game records this place. The check covers the record only: how the action happens in the story, and whether these things could really do it, is yours to judge.'

/** The block a proposal is shown in: its framing, how to read it, then what `renderProposedOutcome` gives. */
export const proposedOutcomeBlock = ({ body, framing = PROPOSED_OUTCOME_FRAMING, explanation = PROPOSED_OUTCOME_EXPLANATION }: { body: string; framing?: string; explanation?: string }): string => (
    `${framing}: ${explanation}\n\n${body}`
)

/**
 * The judge prompt: the fixed instructions, the scene text (which begins `Scene: `), a proposal's block if there is one, then the request,
 * which `Mentions` needs as the last line. `instructions` replaces the fixed text for a probe of a draft; nothing in production passes it.
 */
export const composeJudgePrompt = ({ sceneText, request, instructions = JUDGE_INSTRUCTIONS, proposedOutcome }: { sceneText: string; request: string; instructions?: string; proposedOutcome?: string }): string => (
    [instructions, sceneText, ...(proposedOutcome === undefined ? [] : [proposedOutcome]), `Request: ${request}`].join('\n\n')
)
