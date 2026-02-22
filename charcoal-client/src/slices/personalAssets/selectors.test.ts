import { describe, it, expect } from 'vitest'
import { getBase, getLocalStandardForm, getStandardForm } from '.'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'

const EMPTY_BASE: StandardFormData = { universalKey: 'ASSET#uninitialized', components: [], metaData: [] }

describe('personalAssets selectors', () => {
  describe('getBase (derived from wmlDataSource)', () => {
    it('should return undefined when asset not in personalAssets', () => {
      const state = {
        personalAssets: { byId: {} },
        wmlDataSource: { publicData: { subscribedStreams: {} } }
      }
      expect(getBase('ASSET#test')(state)).toBeUndefined()
    })

    it('should return EMPTY_BASE fallback when wmlDataSource has no materializedView', () => {
      const state = {
        personalAssets: {
          byId: {
            'ASSET#test': {
              publicData: {
                edit: EMPTY_BASE,
                pendingEdits: [],
                inherited: EMPTY_BASE
              }
            }
          }
        },
        wmlDataSource: { publicData: { subscribedStreams: {} } }
      }
      expect(getBase('ASSET#test')(state)).toEqual(EMPTY_BASE)
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
              publicData: {
                edit: EMPTY_BASE,
                pendingEdits: [],
                inherited: EMPTY_BASE
              }
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
      expect(getBase('ASSET#test')(state)).toBe(view)
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
              publicData: {
                edit: editData,
                pendingEdits: [],
                inherited: view
              }
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
      const local = getLocalStandardForm('ASSET#test')(state)
      expect(local).toBeDefined()
      expect(local.universalKey).toBe('ASSET#test')
      const standard = getStandardForm('ASSET#test')(state)
      expect(standard).toBeDefined()
      expect(standard.universalKey).toBe('ASSET#test')
    })
  })
})
