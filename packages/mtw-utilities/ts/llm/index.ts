import {
    BedrockRuntimeClient,
    ConverseCommand,
  } from "@aws-sdk/client-bedrock-runtime"
  
  const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" })
  
  export const llmCall = async (userMessage: string): Promise<string> => {
    // Set the model ID, e.g., Titan Text Express.
    const titanModelId = "amazon.titan-text-express-v1"
    
    // Start a conversation with the user message.
    const conversation = [
        {
        role: "user" as const,
        content: [{ text: userMessage }],
        },
    ];
    
    // Create a command with the model ID, the message, and a basic configuration.
    const command = new ConverseCommand({
        modelId: titanModelId,
        messages: conversation,
        inferenceConfig: { maxTokens: 512, temperature: 0.5, topP: 0.9 },
    });
    
    try {
        // Send the command to the model and wait for the response
        const response = await bedrockClient.send(command);
    
        // Extract and return the response text.
        if (response?.output?.message?.content) {
            const responseText = response.output.message.content[0].text;
            return (responseText ?? '').trim()
        }
        return ''
    } catch (err) {
        console.log(`ERROR: Can't invoke '${titanModelId}'. Reason: ${err}`)
        throw err
    }
  }
