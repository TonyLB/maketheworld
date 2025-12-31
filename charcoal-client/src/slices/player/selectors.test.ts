import { describe, it, expect } from 'vitest'

import { getMyAssets, getMyDraftAssets, getMyPersonalAssets } from './index'

describe('player selectors - zone filtering', () => {
    const mockState = {
        playerDataSource: {
            publicData: {
                activeStreamKeys: [],
                subscribedStreams: {
                    'test-player': {
                        materializedView: {
                            type: 'Snapshot',
                            assets: [
                                { AssetId: 'draft-1', Story: true, instance: false, zone: 'Draft' as any },
                                { AssetId: 'personal-1', Story: false, instance: true, zone: 'Personal' as any },
                                { AssetId: 'legacy-1', Story: false, instance: false } as any
                            ],
                            characters: [],
                            settings: {}
                        }
                    }
                }
            }
        },
        settings: {
            server: {
                ChatPrompt: 'What do you do?'
            },
            client: {
                TextEntryLines: 1,
                ShowNeighborhoodHeaders: false,
                AlwaysShowOnboarding: false
            },
            connection: {
                sessionId: 'session',
                playerName: 'test-player'
            }
        }
    }

    it('getMyAssets returns all assets regardless of zone', () => {
        const assets = getMyAssets(mockState)
        expect(assets.map((a: any) => a.AssetId).sort()).toEqual(['draft-1', 'legacy-1', 'personal-1'])
    })

    it('getMyDraftAssets returns only Draft zone assets', () => {
        const assets = getMyDraftAssets(mockState)
        expect(assets.map((a: any) => a.AssetId)).toEqual(['draft-1'])
    })

    it('getMyPersonalAssets returns only Personal zone assets', () => {
        const assets = getMyPersonalAssets(mockState)
        expect(assets.map((a: any) => a.AssetId)).toEqual(['personal-1'])
    })
})


