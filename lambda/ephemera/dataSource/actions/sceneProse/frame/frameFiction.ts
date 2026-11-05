//
// Layer 2a of the prompt frame (sceneProjection SP-11, provisional line): what is reasonable to do in the fiction and what stops it.
// Lifted verbatim from the probe's prompt.
//

/**
 * Which register wins on what: the scene on what is here and how it is placed, the world on what follows from it. A closing sentence
 * about a chair secured to the floor went 2026-11-04: "the table is glued to the floor" may have come from it, and what a securing
 * binds is now said per securing, in the scene's Rules section (`sceneRules.ts`).
 */
export const PRECEDENCE = 'Beyond that, use what you know about the world: what things are like and what they could physically be used for. The scene tells you what is here and how it is placed; it is true. What follows from that, what goes with what and what a thing can be used for, comes from how things are in the world. Where your knowledge and the scene disagree about what is here or how it is placed, the scene wins. The records are the way to write it down, and their layout is not a rule about what moves.'

/** The blocker ladder: the simplest steps, then freeing one blocker, then the puzzle-solver's paths. One block, its lines joined by newlines. */
export const LADDER = [
    'To work out how to do what someone asks, go in this order, and stop at the first step that gives an answer.',
    '1. Take the simplest way to do it: the steps, using only the things the request involves. For each step, ask whether anything stops it: something the scene records, such as being secured, or something about the things themselves, such as a motorcycle that cannot fit in a shoebox. If nothing stops any step, those steps are your answer.',
    '2. If something stops a step, ask whether freeing or removing that one thing, and then taking the same steps, works. If so, that is your answer.',
    '3. If not, think like a player solving a puzzle: the obstacle may suggest another way, using anything here for anything it could do, not only what it is usually for. If you find one, that is your answer; if there is none, say what would have to change first.',
    'When you give the steps, give the steps you take, not this order.',
].join('\n')
