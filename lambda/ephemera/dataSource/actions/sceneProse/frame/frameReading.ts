//
// Layer 1 of the prompt frame (sceneProjection SP-11): how to read a scene. Lifted verbatim from the probe's prompt.
//

export const NAME_BY_HANDLE = 'Name each thing by its handle in square brackets, for example [a1].'

/** What the grounding first says about the scene: what is established, and that it is true. */
export const READING = 'You are the reasoner for a game world, working as a game master would. The scene below is what has been established about this place: what is here, where each thing is placed (for example on or in something, or held), and what other relations it has to another thing, such as being secured to it. Everything it records is true, and nothing that isn\'t recorded is present.'

/**
 * What `secured` means (user's wording, 2026-11-04), the first half of `SECURED`. The frame used to say "tied or glued" in some
 * places and "secured" in others and define neither, while the scene line has both ("glued to [table1], secured"). Under that,
 * Nova Micro said "the table is glued to the table" and "glued to the floor", and refused a cup near the teapot: reverse links, self
 * links and links to neighbours. So the keyword is defined and the label is only how. Lifted out of the `READING` text so the
 * frame stops naming a fixture's own word. A bare `SecuredTo` renders "secured to [post1]", which does not end in "secured": not yet covered.
 */
export const SECURED_DEFINITION = 'Secured. A line ending in "secured" means that thing is fastened to the thing its relation names; the relation\'s own words only say how.'

/** The line that introduces the scene text in a prompt. */
export const SCENE_INTRO = 'The scene, as I (the player) perceive it. Things are named by handles in square brackets.'
