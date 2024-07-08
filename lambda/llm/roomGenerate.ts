export const roomGeneratePrompt = async (name: string): Promise<string> => {
    return `User: Act like you are providing setting descriptions for a role playing game. You are tasked to provide JSON format including descriptive paragraphs of a place for the benefit of someone playing the role of a character in that place. Please follow the instructions below in crafting a description and summary based on the provided context.

    Output Schema:
    You MUST answer in JSON format only
    DO NOT use any other format while answering the question
    Please wrap the entire output in JSON format as shared below:

    \`\`\`json {
        "description": "description goes here",
        "summary": "summary goes here"
    }\`\`\`

    Instructions:
    DO NOT specify things that could not be directly and immediately perceived from a viewpoint in the place
    DO NOT describe the emotions or judgments of the audience
    DO NOT directly address the audience
    - Description:
        1. Create the start of the description by writing a broad overview of the entire place, expressed as a noun-phrase. If the name could express either an interior or exterior viewpoint, describe from the interior viewpoint.
        2. Further describe any major features which dominate the scene in separate sentences, up to three sentences total
        3. If there would be features in the place that the player might want their character to interact with, describe them next up to two further sentences
        4. Remove any value judgments or conclusions that have been expressed
        5. If anything has been expressed that could not be directly and immediately perceived from a viewpoint in the place, either replace that with a description of direct perceptions that implies the larger pattern, or remove the conclusion
    - Summary:
        1. Once you have completed the description, begin the summary with an overview of the entire place, expressed as a noun-phrase
        2. Next summarize the most immediately perceptible points of the description, up to two additional sentences

    Context:
    The name of the place is "${name}"

    Assist: \`\`\`json
    `
}