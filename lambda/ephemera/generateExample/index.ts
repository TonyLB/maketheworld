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
    invokeBedrockConverseText,
    type InvokeBedrockConverseTextParams,
    type InvokeBedrockConverseTextResult,
    type InvokeBedrockConverseTextSuccess,
    type InvokeBedrockConverseTextFailure,
} from './invokeBedrockConverseText'

export {
    invokeBedrockRoomDescription,
    BEDROCK_ROOM_DESCRIPTION_MODEL_ID,
    BEDROCK_REQUEST_TIMEOUT_MS,
    BEDROCK_MAX_TOKENS,
    type InvokeBedrockRoomDescriptionResult,
    type InvokeBedrockRoomDescriptionSuccess,
    type InvokeBedrockRoomDescriptionFailure,
} from './invokeBedrockRoomDescription'

export {
    invokeBedrockParseCommand,
    BEDROCK_PARSE_COMMAND_MODEL_ID,
    BEDROCK_PARSE_COMMAND_TIMEOUT_MS,
    BEDROCK_PARSE_COMMAND_MAX_TOKENS,
    type InvokeBedrockParseCommandResult,
    type InvokeBedrockParseCommandSuccess,
    type InvokeBedrockParseCommandFailure,
} from './invokeBedrockParseCommand'
