import { bedrockPromptForVerbose } from './bedrockPromptForVerbose'

describe('bedrockPromptForVerbose', () => {
    it('concatenates invariantPrefix and dynamicSuffix into fullText', () => {
        const result = bedrockPromptForVerbose({
            invariantPrefix: 'STATIC_',
            dynamicSuffix: 'DYNAMIC',
        })
        expect(result).toEqual({
            invariantPrefix: 'STATIC_',
            dynamicSuffix: 'DYNAMIC',
            fullText: 'STATIC_DYNAMIC',
        })
    })
})
