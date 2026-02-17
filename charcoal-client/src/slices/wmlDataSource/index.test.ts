import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  wmlDataSourceSlice,
  wmlDataSourceSelectors,
  subscribeToWmlDataSource,
  unsubscribeFromWmlDataSource,
  getActiveStreamKeys,
  getSubscribedStreams,
  processRawSnapshot,
  processRawEvent,
  resolveSidecarSnapshot
} from './index'
import { getWMLBase } from './selectors'
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

    it('should export processRawSnapshot and processRawEvent', () => {
      expect(processRawSnapshot).toBeDefined()
      expect(processRawEvent).toBeDefined()
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

  describe('resolveSidecarSnapshot', () => {
    const minimalWML = '<Asset uuid=(test)></Asset>'

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    it('should fetch sidecarUrl and return WML payload object', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(minimalWML)
      } as Response)

      const result = await resolveSidecarSnapshot('ASSET#test', 'https://example.com/sidecar', {})

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/sidecar')
      expect(result).toEqual({ wml: minimalWML })
    })

    it('should normalize CR in WML', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(minimalWML.replace('\n', '\r\n'))
      } as Response)

      const result = await resolveSidecarSnapshot('ASSET#test', 'https://example.com/sidecar', {})
      expect(result).toBeDefined()
      expect(result.wml).not.toContain('\r')
    })

    it('should throw when fetch returns not ok', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response)

      await expect(
        resolveSidecarSnapshot('ASSET#test', 'https://example.com/sidecar', {})
      ).rejects.toThrow(/Sidecar fetch failed: 404/)
    })
  })
})
