import { llmCall } from '@tonylb/mtw-utilities/ts/llm'

export const roomGeneratePrompt = async (name: string): Promise<string> => {
    return `Act like you are a game master in a role playing game. You are tasked to describe a place for the benefit of someone playing the role of a character in that place. Please follow the instructions below in crafting a description based on the provided context.
    
    Instructions:
    - Begin with a broad overview of the entire place
    - Further describe any major features which dominate the scene
    - If there would be features in the place that the player might want their character to interact with, describe them next

    Output:
    DO NOT describe the emotions of the audience, or any other internal response that is the responsibility of the player to decide for their character.
    Write between three and five sentences.

    Context:
    The name of the place is "${name}"
    `
}