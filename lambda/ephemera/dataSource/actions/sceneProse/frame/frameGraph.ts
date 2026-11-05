//
// Layer 2b of the prompt frame (sceneProjection SP-11): how a result is recorded as graph edits. Lifted verbatim from the probe's prompt.
//

export const NOTATION = 'Write any move in the (move X to On Y) or (move X to In Y) notation above, and anything else in any notation you like.'

/**
 * How a move works (user's wording, 2026-11-03, SP-10): the first piece of an operation vocabulary, kept to broad strokes,
 * to bridge the fiction (things placed to move together) and the records (a subtree moves, its old host only loses it).
 * Added after the first multi-register batch (teaTable, "pick up [cup1]") showed the saucer coming with the cup in 10 of
 * 12 answers: the direction of "on" was reversed. The example avoids the fixtures' domain (tableware), as the grounding's
 * examples do. Batches before this paragraph are not comparable with batches after it.
 *
 * Reworded the same day (direction audit): "placed to move together" was mutual, and "on or in X ... on or in Y" crossed two
 * relations in one sentence, so the paragraph now says what is on or in X goes with X "but not the other way round". The
 * grounding's "how things are connected" went at the same time (models reasoned "because they are directly connected").
 * Reworded again (blocker ladder, user, 2026-11-03): "Never move its contents separately" contradicted pouring, which moves the tea alone, and the
 * ladder batch showed invented operators (`pour`) and a redundant move of the tea after its cup, so the paragraph now says what a move
 * stands for (any action ending in a new place: pick up, set down, pour) and that one move carries the contents.
 * Tried and taken out (2026-11-03): "To get only part of what it holds out, move that part: to tip a fish out of a bucket onto the dock...".
 * With it, three pours all fixated on the glued teapot (one invented a mug) and one pick-up lifted the saucer and table; the example's
 * bucket, or "what it holds" (the teapot holds tea too), are the suspects, not separated.
 * Then rewritten as two registers (user, 2026-11-03): the world paragraph speaks of results, not actions ("different actions with the same result
 * are the same change"), kept to the recording side ("once you know what would happen") so it grants no feasibility, and the records
 * paragraph speaks only of the graph. Its far-domain example (a crate, a shed, a cart) avoids the fixtures' tableware.
 * Left out on purpose (user, 2026-11-03): how to move a thing and not its contents (move the contents to the thing's host first).
 * No run has needed it, and it describes the end state the model reached by mistake (the tea left on the saucer); parked.
 */
export const MOVING = 'Moving things. Once you know what would happen, the records keep only what is different afterwards, and for a move that is where things are. A crate carried to the shed, or dragged there, or pushed there, leaves the same result: the crate is in the shed, and what was in or on the crate is in the shed with it, but the cart it stood on has not moved. Different actions with the same result are the same change.\n\nIn the records, (move X to On Y) or (move X to In Y) records that X is now on or in Y, using the same "on" and "in" the scene\'s lines use. For the room write In room, and for what you hold write held. What was on or in X stays on or in it, and what X left only loses X. So once you have worked out where things end up, write one move for each thing whose own place changed, not for the things carried along with it.'
