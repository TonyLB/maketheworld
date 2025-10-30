import { describe, it, expect } from 'vitest'

import { getMyAssets, getMyDraftAssets, getMyPersonalAssets } from './selectors'
import type { PlayerPublic } from './baseClasses'

describe('player selectors - zone filtering', () => {
    const basePlayer: PlayerPublic = {
        PlayerName: 'Test',
        CodeOfConductConsent: true,
        Assets: [
            { AssetId: 'draft-1', Story: true, instance: false, zone: 'Draft' as any },
            { AssetId: 'personal-1', Story: false, instance: true, zone: 'Personal' as any },
            { AssetId: 'legacy-1', Story: false, instance: false } as any
        ],
        Characters: [],
        Settings: { onboardCompleteTags: [] },
        SessionId: 'session'
    }

    it('getMyAssets returns all assets regardless of zone', () => {
        const assets = getMyAssets(basePlayer)
        expect(assets.map(a => a.AssetId).sort()).toEqual(['draft-1', 'legacy-1', 'personal-1'])
    })

    it('getMyDraftAssets returns only Draft zone assets', () => {
        const assets = getMyDraftAssets(basePlayer)
        expect(assets.map(a => a.AssetId)).toEqual(['draft-1'])
    })

    it('getMyPersonalAssets returns only Personal zone assets', () => {
        const assets = getMyPersonalAssets(basePlayer)
        expect(assets.map(a => a.AssetId)).toEqual(['personal-1'])
    })
})


