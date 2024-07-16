export const roomGeneratePrompt = async (name: string): Promise<string> => {
    return `Role: You are providing setting descriptions for a role-playing game.

        Task: Provide a description of a place and (separately) a minimal summary of only the essential elements for the benefit of someone playing the role of a character in that place. Follow the instructions below precisely.

        Tone and Content Guidelines:

        Maintain an objective tone, describing only what can be directly and immediately perceived in the place.
        DO NOT specify things that could not be directly and immediately perceived from a viewpoint in the place.
        DO NOT describe the emotions or judgments of the audience.
        DO NOT express value judgments.
        DO NOT include speculation, hypotheticals, history, or hearsay.
        DO NOT directly address the audience.
        DO NOT mention anything inside the "Instructions:" or "Examples:" tag in the response.

        Context:

        The context in which the description and summary should fit is that of a fantasy world during a time of new exploration, with the following specifics:
            Low levels of magic exist and are studied but not yet completely understood
            Non-magical technology is roughly analogous to the very beginning of the Steam Age in reality.

        Instructions:
            Description:
                Provide a detailed, sensory-rich description of the place.
                Focus on visual, auditory, olfactory, and tactile elements that a character would perceive.
            Summary:
                Provide a brief, minimal summary highlighting only the essential elements of the place.
                Keep the summary succinct and focused on the most immediate and critical aspects.

        Output Schema:
            You MUST answer in JSON format only
            DO NOT use any other format while answering the question
            Please wrap the entire output in JSON format as shared below:

            \`\`\`json {
                "description": "Description goes here",
                "summary": "Summary goes here"
            }\`\`\`

        Examples:

            Example 1:
                User: Describe a place named "Alley"
                Bot: \`\`\`json {
                    "description": "A narrow alleyway is flanked by tall, grimy brick buildings that block most of the sunlight. The ground is uneven, covered in scattered debris and puddles of murky water. The air is thick with the smell of dampness and rotting refuse. The distant sound of traffic hums from the main street, while the occasional scurrying of rats and the dripping of water echo in the confined space.",
                    "summary": "A narrow, dimly lit alleyway with a strong smell of dampness and refuse."
                }\`\`\`

            Example 2:
                User: Describe a place named "Grand hall"
                Bot: \`\`\`json {
                    "description": "The hall is illuminated by a massive chandelier hanging from the vaulted ceiling, casting a warm, golden glow over the polished marble floor. The walls are adorned with intricate tapestries depicting scenes of ancient battles. A long, wooden banquet table stretches across the center of the room, set with fine china and silverware. The faint scent of lavender mingles with the aroma of freshly baked bread from the nearby kitchen. Soft classical music plays in the background, barely audible over the murmur of conversations.",
                    "summary": "A spacious hall with elegant fittings and soft music in the background."
                }\`\`\`

            Example 3:
                User: Describe a place named "Edge of chasm"
                Bot: \`\`\`json {
                    "description": "The edge of the chasm is a sheer drop of hundreds of feet, with jagged rocks and cliffs jutting out in every direction. The air is thick with the scent of sulfur, and the sound of rushing water echoes below. The sky is overcast, and the only light comes from the occasional flash of lightning far off in the distance.",
                    "summary": "A dangerous and foreboding cliff edge with a rushing river below."
                }\`\`\`

        User: Describe a place named "${name}"
        Bot: \`\`\`json
    `
}
