//
// Layer 1 of the prompt frame (sceneProjection SP-11): how to read a scene. Lifted verbatim from the probe's prompt.
//

export const NAME_BY_HANDLE = 'Name each thing by its handle in square brackets, for example [a1].'

/**
 * What the grounding first says about the scene: what is established, and that it is true. It says "secured", not "tied or glued"
 * (2026-11-04): the frame's examples match no fixture, and "glued" is `teaTable`'s word.
 */
export const READING = 'You are the reasoner for a game world, working as a game master would. The scene below is what has been established about this place: what is here, where each thing is placed (for example on or in something, or held), and what other relations it has to another thing, such as being secured to it. Everything it records is true, and nothing that isn\'t recorded is present.'

/** The line that introduces the scene text in a prompt. */
export const SCENE_INTRO = 'The scene, as I (the player) perceive it. Things are named by handles in square brackets.'
