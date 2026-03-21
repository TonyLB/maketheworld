//
// Bedrock-backed room description generation for cache examples.
//

export {
    generateRoomDescription,
    type GenerateRoomDescriptionInput,
    type GenerateRoomDescriptionResult,
    type GenerateRoomDescriptionSuccess,
    type GenerateRoomDescriptionFailure,
} from './generateRoomDescription'

export {
    buildRoomDescriptionPrompt,
    type BuildRoomDescriptionPromptInput,
} from './buildRoomDescriptionPrompt'

export {
    invokeBedrockRoomDescription,
    BEDROCK_ROOM_DESCRIPTION_MODEL_ID,
    BEDROCK_REQUEST_TIMEOUT_MS,
    BEDROCK_MAX_TOKENS,
    type InvokeBedrockRoomDescriptionResult,
    type InvokeBedrockRoomDescriptionSuccess,
    type InvokeBedrockRoomDescriptionFailure,
} from './invokeBedrockRoomDescription'
