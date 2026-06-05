import { describe, it, expect } from 'vitest'
import {
  wmlDataSourceSlice,
  wmlDataSourceSelectors,
  subscribeToWmlDataSource,
  unsubscribeFromWmlDataSource,
  getActiveStreamKeys,
  getSubscribedStreams,
  processEnvelope,
  registerWmlAfterProcessEnvelopeConsumer
} from './index'
import { getWMLBase, getWMLConfirmedRequestIds } from './selectors'
import { CONFIRMED_TTL_MS } from '../dataSource'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'

describe('wmlDataSource slice', () => {
  describe('slice creation', () => {
    it('should create slice with correct name', () => {
      expect(wmlDataSourceSlice.name).toBe('wmlDataSource')
    })

    it('should have initial state with publicData', () => {
      const state = wmlDataSourceSlice.getInitialState()
      expect(state).toBeDefined()
      expect(state).toHaveProperty('publicData')
      expect(state.publicData.activeStreamKeys).toEqual([])
      expect(state.publicData.subscribedStreams).toEqual({})
    })

    it('should export getActiveStreamKeys and getSubscribedStreams', () => {
      expect(getActiveStreamKeys).toBeDefined()
      expect(getSubscribedStreams).toBeDefined()
      expect(wmlDataSourceSelectors.getActiveStreamKeys).toBeDefined()
      expect(wmlDataSourceSelectors.getSubscribedStreams).toBeDefined()
    })

    it('should export subscribeToWmlDataSource and unsubscribeFromWmlDataSource', () => {
      expect(subscribeToWmlDataSource).toBeDefined()
      expect(unsubscribeFromWmlDataSource).toBeDefined()
    })

    it('should export processEnvelope', () => {
      expect(processEnvelope).toBeDefined()
    })

    it('should export registerWmlAfterProcessEnvelopeConsumer', () => {
      expect(registerWmlAfterProcessEnvelopeConsumer).toBeDefined()
      expect(typeof registerWmlAfterProcessEnvelopeConsumer).toBe('function')
    })
  })

  describe('getWMLBase selector', () => {
    it('should return undefined when no wmlDataSource state', () => {
      const state = {}
      expect(getWMLBase(state, 'ASSET#any')).toBeUndefined()
    })

    it('should return undefined when stream not subscribed', () => {
      const state = {
        wmlDataSource: {
          publicData: {
            subscribedStreams: {}
          }
        }
      }
      expect(getWMLBase(state, 'ASSET#test')).toBeUndefined()
    })

    it('should return materializedView for subscribed asset', () => {
      const view: StandardFormData = {
        universalKey: 'ASSET#test' as any,
        components: [],
        metaData: []
      }
      const state = {
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
      expect(getWMLBase(state, 'ASSET#test')).toBe(view)
    })
  })

  describe('getWMLConfirmedRequestIds selector', () => {
    it('should be exported and callable', () => {
      expect(getWMLConfirmedRequestIds).toBeDefined()
      expect(typeof getWMLConfirmedRequestIds).toBe('function')
    })

    it('should return an empty array when stream is not subscribed', () => {
      const state = {
        wmlDataSource: {
          publicData: {
            subscribedStreams: {}
          }
        }
      }
      expect(getWMLConfirmedRequestIds(state, 'ASSET#test')).toEqual([])
    })

    it('should return ids within TTL and exclude stale rows when now is injected', () => {
      const now = CONFIRMED_TTL_MS
      const state = {
        wmlDataSource: {
          publicData: {
            subscribedStreams: {
              'ASSET#test': {
                materializedView: {
                  universalKey: 'ASSET#test' as any,
                  components: [],
                  metaData: []
                },
                recentEvents: [],
                confirmedRequestIds: [
                  { id: 'stale', seenAt: 0 },
                  { id: 'fresh', seenAt: now - 1 }
                ]
              }
            }
          }
        }
      }
      expect(getWMLConfirmedRequestIds(state, 'ASSET#test', now)).toEqual(['fresh'])
    })

    it('returns same reference on double read with unchanged storage and fixed now (I1)', () => {
      const now = CONFIRMED_TTL_MS
      const state = {
        wmlDataSource: {
          publicData: {
            subscribedStreams: {
              'ASSET#test': {
                materializedView: {
                  universalKey: 'ASSET#test' as any,
                  components: [],
                  metaData: []
                },
                recentEvents: [],
                confirmedRequestIds: [
                  { id: 'req-a', seenAt: now - 1 },
                  { id: 'req-b', seenAt: now - 2 }
                ]
              }
            }
          }
        }
      }
      const first = getWMLConfirmedRequestIds(state, 'ASSET#test', now)
      const second = getWMLConfirmedRequestIds(state, 'ASSET#test', now)
      expect(second).toBe(first)
    })
  })

})
