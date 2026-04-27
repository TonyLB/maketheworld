import { enrichAcmeOrder } from './index'

describe('enrichAcmeOrder', () => {
    it('returns merged AcmeOrder and reasoning when enrich invoke succeeds', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: `## Notes
Check catalog.

\`\`\`json
{
  "lines": [
    {
      "valid": true,
      "name": "rope",
      "stableKey": "rope",
      "affinities": [{ "role": "delivery", "aptness": 0.6 }]
    }
  ],
  "confidence": 0.9
}
\`\`\``,
        })

        const output = await enrichAcmeOrder(
            { command: 'order rope', occupiedStableKeys: ['existing-key'] },
            0.8,
            invokeBedrockAcmeOrderEnrichImpl
        )

        expect(output.result).toEqual({
            type: 'AcmeOrder',
            orders: [{
                valid: true,
                name: 'rope',
                stableKey: 'rope',
                affinities: [{ role: 'delivery', aptness: 0.6 }],
            }],
            confidence: 0.8 * 0.9,
        })
        expect(output.enrichReasoningMarkdown).toContain('Notes')
        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalledTimes(1)
        const parts = invokeBedrockAcmeOrderEnrichImpl.mock.calls[0]?.[0] as { dynamicSuffix: string }
        expect(parts.dynamicSuffix).toContain('- existing-key')
    })

    it('falls back to synthetic valid line when enrich invoke fails', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: false,
            errorMessage: 'timeout',
        })

        const output = await enrichAcmeOrder(
            { command: 'order anvil from acme' },
            0.75,
            invokeBedrockAcmeOrderEnrichImpl
        )

        expect(output.result).toEqual({
            type: 'AcmeOrder',
            orders: [{
                valid: true,
                name: 'order anvil from acme',
                stableKey: 'order-anvil-from-acme',
                affinities: [],
                affinitiesFailed: true,
            }],
            confidence: 0.75,
        })
        expect(output.enrichReasoningMarkdown).toBe('')
    })
})
