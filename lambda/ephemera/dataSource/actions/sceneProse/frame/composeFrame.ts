//
// Composing the prompt frame from its layers (sceneProjection SP-11). The grounding is reading, then fiction, then graph, as blocks
// separated by a blank line; a prompt is that grounding, the scene intro, the scene, the question and the answer text.
// The 2a/2b line is provisional, so a caller supplies the layers it needs.
//
import { SCENE_INTRO } from './frameReading'

/*
 * The grounding, composed here from the layers (user, 2026-11-02): the scene is what has been established and wins over general
 * knowledge, which fills in what things are like and what can be done with them. Without it Nova Micro answered "can you
 * pour tea" from what teapots are usually like and picked up a teapot the scene records as secured. The examples match no
 * fixture, so they teach the precedence without giving away a rubric's answer, and stay off tableware: "a lid can be
 * lifted" had Nova Micro lifting lids on teaTable's teapot and saucer, neither of which the scene gives a lid. The
 * register is a puzzle-solver's, not everyday life's (user, 2026-11-02): asked what someone could "reasonably" do, both
 * Nova models held to the teapot as the way to pour, past a glue that blocked it, and never offered the cup's tea.
 * A closing line "A thing on or in another moves with it." was dropped (2026-11-03, reopened SP-7) to test whether it
 * caused D's ancestor-chain answers to "what is X in or on". Without it the chains went away on teaTable and stayed on
 * sideboard (SP-7 batches 8 and 9), so it is not their cause; restore it if lifting questions show it was needed.
 *
 * Reworked 2026-11-03 (user), after the render comparison under `abstain` over-moved things the request never touched (the
 * saucer, the glued teapot, to "clear the table") and invented operators. Cause suspected in this block, not a belief of
 * the model's: it assumed a blocker ("when the obvious way is blocked", "if what someone wants is blocked, say what
 * blocks it") and never said "nothing blocks it" is a result. A negative added to that would not have worked, so the
 * procedure is now an ordered, all-positive ladder: the simplest steps, checked step by step (a blocker belongs to a step,
 * not to a thing, and is the scene's or the world's: a tie, or a motorcycle that cannot fit a shoebox); then freeing what
 * stops a step; only then the puzzle-solver's inventive paths. "Stop at the first step that gives an answer" and "give the
 * steps you take, not this order" guard against the model writing every rung out, as `headings` and `candidates` did.
 * The precedence line is by register: the scene is authoritative about what is here and how it is placed, the world about
 * what follows from that, and the records' layout is notation, not a rule about what moves (suspected: "the scene wins"
 * made a misread graph outrank correct physics). The ladder, the precedence line and the MOVING edit went in together, so
 * their shares are not separable. Batches before this edit are not comparable with batches after it.
 */

/** A grounding: its layers in order, one blank line between blocks. */
export const composeFrame = ({ reading, fiction, graph }: { reading: string; fiction: string; graph: string }): string => (
    [reading, fiction, graph].join('\n\n')
)

/** The one frame: the grounding, the scene text, the question line and the answer text. */
export const scenePrompt = ({ frame, sceneText, question, answer }: { frame: string; sceneText: string; question: string; answer: string }): string => [
    frame,
    '',
    SCENE_INTRO,
    '',
    sceneText,
    '',
    `Question: ${question}`,
    answer,
].join('\n')
