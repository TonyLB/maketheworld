export type NovaModel = 'NovaMicro' | 'Nova2Lite'

export const BEDROCK_NOVA_MICRO_MODEL_ID = 'us.amazon.nova-micro-v1:0' as const
export const BEDROCK_NOVA_2_LITE_MODEL_ID = 'us.amazon.nova-2-lite-v1:0' as const

export const DEFAULT_NOVA_MODEL: NovaModel = 'Nova2Lite'

export function novaModelToBedrockModelId(model: NovaModel): string {
    switch (model) {
        case 'NovaMicro':
            return BEDROCK_NOVA_MICRO_MODEL_ID
        case 'Nova2Lite':
            return BEDROCK_NOVA_2_LITE_MODEL_ID
        default: {
            const exhaustiveCheck: never = model
            return exhaustiveCheck
        }
    }
}
