import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getBase, getEffectivePendingEdits, getLocalStandardForm, getStandardForm } from '.'
import { selectEffectivePendingEdits } from './selectors'
import { PENDING_TTL_MS, CONFIRMED_TTL_MS } from '../dataSource'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import type { PersonalAssetsPublic } from './baseClasses'
import type { RootState } from '../../store'

const EMPTY_BASE: StandardFormData = { universalKey: 'ASSET#uninitialized', components: [], metaData: [] }

type WmlSubscribedStream = {
  materializedView?: StandardFormData
  recentEvents: unknown[]
  confirmedRequestIds?: { id: string; seenAt: number }[]
}

/** Minimal root slices for selector tests; wrapped selectors expect full RootState. */
type SelectorTestState = {
  personalAssets: {
    byId: Record<string, { publicData: PersonalAssetsPublic }>
  }
  wmlDataSource: {
    publicData: {
      subscribedStreams: Record<string, WmlSubscribedStream>
    }
  }
}

const asRootState = (state: SelectorTestState): RootState => state as RootState

const minimalPublicData = (overrides: Partial<PersonalAssetsPublic> = {}): PersonalAssetsPublic => ({
  edit: EMPTY_BASE,
  pendingEdits: [],
  inherited: EMPTY_BASE,
  importData: {},
  properties: {},
  loadedImages: {},
  ...overrides
})

const wmlToJSON = (wml: string): StandardFormData => {
  const schema = new Schema()
  schema.loadWML(deIndentWML(wml))
  return new StandardForm(schema.schema[0]).toJSON()
}

const localRoomShortName = (
  state: SelectorTestState,
  assetId: string,
  roomId: ComponentUUID
): string | undefined => {
  const local = new StandardForm(getLocalStandardForm(assetId)(asRootState(state))!)
  const room = local.byUniversalId[roomId]
  if (!(room instanceof StandardRoom)) {
    return undefined
  }
  const shortNameJson = room.shortName?.toJSON()
  return typeof shortNameJson === 'string' ? shortNameJson : undefined
}

describe('personalAssets selectors', () => {
  describe('getBase (derived from wmlDataSource)', () => {
    it('should return undefined when asset not in personalAssets', () => {
      const state = {
        personalAssets: { byId: {} },
        wmlDataSource: { publicData: { subscribedStreams: {} } }
      }
      expect(getBase('ASSET#test')(asRootState(state))).toBeUndefined()
    })

    it('should return EMPTY_BASE fallback when wmlDataSource has no materializedView', () => {
      const state = {
        personalAssets: {
          byId: {
            'ASSET#test': {
              publicData: minimalPublicData()
            }
          }
        },
        wmlDataSource: { publicData: { subscribedStreams: {} } }
      }
      expect(getBase('ASSET#test')(asRootState(state))).toEqual(EMPTY_BASE)
    })

    it('should return materializedView from wmlDataSource when subscribed', () => {
      const view: StandardFormData = {
        universalKey: 'ASSET#test' as any,
        components: [],
        metaData: []
      }
      const state = {
        personalAssets: {
          byId: {
            'ASSET#test': {
              publicData: minimalPublicData()
            }
          }
        },
        wmlDataSource: {
          publicData: {
            subscribedStreams: {
              'ASSET#test': {
                materializedView: view,
                recentEvents: []
              }
            }
          }
        }
      }
      expect(getBase('ASSET#test')(asRootState(state))).toBe(view)
    })
  })

  describe('getLocalStandardForm and getStandardForm (with derived base)', () => {
    it('should derive standard form using base from wmlDataSource', () => {
      const view: StandardFormData = {
        universalKey: 'ASSET#test' as any,
        components: [],
        metaData: []
      }
      const editData: StandardFormData = {
        universalKey: 'ASSET#test' as any,
        components: [],
        metaData: []
      }
      const state = {
        personalAssets: {
          byId: {
            'ASSET#test': {
              publicData: minimalPublicData({
                edit: editData,
                inherited: view
              })
            }
          }
        },
        wmlDataSource: {
          publicData: {
            subscribedStreams: {
              'ASSET#test': {
                materializedView: view,
                recentEvents: []
              }
            }
          }
        }
      }
      const local = getLocalStandardForm('ASSET#test')(asRootState(state))
      expect(local).toBeDefined()
      expect(local.universalKey).toBe('ASSET#test')
      const standard = getStandardForm('ASSET#test')(asRootState(state))
      expect(standard).toBeDefined()
      expect(standard.universalKey).toBe('ASSET#test')
    })
  })

  describe('getEffectivePendingEdits and getLocalStandardForm (effective pending)', () => {
    const ASSET_ID = 'ASSET#assetC'
    const VORTEX_ID = 'ROOM#vortex' as ComponentUUID
    const NOW = 1_000_000

    beforeEach(() => {
      vi.setSystemTime(NOW)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const editWithVortexShortName = wmlToJSON(`
      <Asset uuid=(assetC)>
        <Room uuid=(vortex) ref={0}><ShortName>Cliff Base</ShortName></Room>
      </Asset>
    `)

    const baseWithShortName = wmlToJSON(`
      <Asset uuid=(assetC)>
        <Room uuid=(vortex) from=(ASSET#primitives) ref={0}>
          <ShortName>Cliff Base</ShortName>
        </Room>
      </Asset>
    `)

    const pendingRow = (requestId: string, time: number) => ({
      meta: { key: requestId, time },
      edit: editWithVortexShortName
    })

    const stateWithPending = (
      pendingEdits: PersonalAssetsPublic['pendingEdits'],
      confirmedRequestIds: { id: string; seenAt: number }[] = []
    ): SelectorTestState => ({
      personalAssets: {
        byId: {
          [ASSET_ID]: {
            publicData: minimalPublicData({ pendingEdits })
          }
        }
      },
      wmlDataSource: {
        publicData: {
          subscribedStreams: {
            [ASSET_ID]: {
              materializedView: baseWithShortName,
              recentEvents: [],
              confirmedRequestIds
            }
          }
        }
      }
    })

    it('selectEffectivePendingEdits excludes confirmed ids', () => {
      const pendingEdits = [
        pendingRow('req-a', NOW),
        pendingRow('req-b', NOW)
      ]
      const effective = selectEffectivePendingEdits(pendingEdits, ['req-a'], NOW)
      expect(effective).toHaveLength(1)
      expect(effective[0].meta.key).toBe('req-b')
    })

    it('selectEffectivePendingEdits excludes pending older than PENDING_TTL_MS', () => {
      const pendingEdits = [
        pendingRow('stale', NOW - PENDING_TTL_MS),
        pendingRow('fresh', NOW - PENDING_TTL_MS + 1)
      ]
      const effective = selectEffectivePendingEdits(pendingEdits, [], NOW)
      expect(effective).toHaveLength(1)
      expect(effective[0].meta.key).toBe('fresh')
    })

    it('getEffectivePendingEdits via augment excludes confirmed ids from wmlDataSource', () => {
      const state = stateWithPending(
        [pendingRow('req-a', NOW), pendingRow('req-b', NOW)],
        [{ id: 'req-a', seenAt: NOW - 1 }]
      )
      const effective = getEffectivePendingEdits(ASSET_ID)(asRootState(state))
      expect(effective).toHaveLength(1)
      expect(effective![0].meta.key).toBe('req-b')
    })

    it('getLocalStandardForm does not double when base updated and pending confirmed', () => {
      const state = stateWithPending(
        [pendingRow('req-a', NOW)],
        [{ id: 'req-a', seenAt: NOW - CONFIRMED_TTL_MS + 1 }]
      )
      expect(localRoomShortName(state, ASSET_ID, VORTEX_ID)).toBe('Cliff Base')
    })

    it('getLocalStandardForm merges fresh unconfirmed pending', () => {
      const baseWithoutShortName = wmlToJSON(`
        <Asset uuid=(assetC)>
          <Room uuid=(vortex) from=(ASSET#primitives) ref={0} />
        </Asset>
      `)
      const state = {
        personalAssets: {
          byId: {
            [ASSET_ID]: {
              publicData: minimalPublicData({
                pendingEdits: [pendingRow('req-a', NOW)]
              })
            }
          }
        },
        wmlDataSource: {
          publicData: {
            subscribedStreams: {
              [ASSET_ID]: {
                materializedView: baseWithoutShortName,
                recentEvents: [],
                confirmedRequestIds: []
              }
            }
          }
        }
      }
      expect(localRoomShortName(state, ASSET_ID, VORTEX_ID)).toBe('Cliff Base')
    })

    describe('referential stability (I1)', () => {
      const stabilityState = () =>
        stateWithPending(
          [pendingRow('req-a', NOW), pendingRow('req-b', NOW)],
          [{ id: 'req-a', seenAt: NOW - 1 }]
        )

      // Flip to it(...) when E5/E6 land (Phase 3).
      it.fails('getLocalStandardForm returns same reference on unchanged store semantics', () => {
        const state = stabilityState()
        const sel = getLocalStandardForm(ASSET_ID)
        const first = sel(asRootState(state))
        const second = sel(asRootState(state))
        expect(second).toBe(first)
      })

      // Flip to it(...) when E5/E6 land (Phase 3).
      it.fails('getStandardForm returns same reference on unchanged store semantics', () => {
        const state = stabilityState()
        const sel = getStandardForm(ASSET_ID)
        const first = sel(asRootState(state))
        const second = sel(asRootState(state))
        expect(second).toBe(first)
      })

      // Flip to it(...) when E5 lands (Phase 3).
      it.fails('getEffectivePendingEdits returns same reference on unchanged store semantics', () => {
        const state = stabilityState()
        const sel = getEffectivePendingEdits(ASSET_ID)
        const first = sel(asRootState(state))
        const second = sel(asRootState(state))
        expect(second).toBe(first)
      })
    })
  })
})
