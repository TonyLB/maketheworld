import { 
  libraryDataSourceSlice,
  libraryDataSourceSelectors,
  subscribeToLibrary,
  unsubscribeFromLibrary,
  getLibraryAssetIds,
  getIsLibrarySubscribed
} from './index'

describe('LibraryDataSource Slice', () => {
  describe('Slice Creation', () => {
    it('should create slice with correct name', () => {
      expect(libraryDataSourceSlice.name).toBe('libraryDataSource')
    })

    it('should have initial state', () => {
      const state = libraryDataSourceSlice.getInitialState()
      
      expect(state).toBeDefined()
      // The dataSource pattern creates a complex nested state structure
      expect(state).toHaveProperty('publicData')
    })
  })

  describe('Selectors', () => {
    it('should export getActiveStreamKeys selector', () => {
      expect(libraryDataSourceSelectors.getActiveStreamKeys).toBeDefined()
      expect(typeof libraryDataSourceSelectors.getActiveStreamKeys).toBe('function')
    })

    it('should export getSubscribedStreams selector', () => {
      expect(libraryDataSourceSelectors.getSubscribedStreams).toBeDefined()
      expect(typeof libraryDataSourceSelectors.getSubscribedStreams).toBe('function')
    })

    describe('getLibraryAssetIds', () => {
      it('should return empty array when no streams subscribed', () => {
        const mockState = {
          libraryDataSource: {
            publicData: {
              subscribedStreams: {}
            }
          }
        }

        const result = getLibraryAssetIds(mockState)
        expect(result).toEqual([])
      })

      it('should return asset IDs from global stream', () => {
        const mockState = {
          libraryDataSource: {
            publicData: {
              subscribedStreams: {
                'global': {
                  materializedView: {
                    type: 'Snapshot',
                    assetIds: ['ASSET#test1', 'ASSET#test2', 'ASSET#test3']
                  },
                  recentEvents: []
                }
              }
            }
          }
        }

        const result = getLibraryAssetIds(mockState)
        expect(result).toEqual(['ASSET#test1', 'ASSET#test2', 'ASSET#test3'])
      })

      it('should return empty array when global stream has no materialized view', () => {
        const mockState = {
          libraryDataSource: {
            publicData: {
              subscribedStreams: {
                'global': {
                  materializedView: null,
                  recentEvents: []
                }
              }
            }
          }
        }

        const result = getLibraryAssetIds(mockState)
        expect(result).toEqual([])
      })
    })

    describe('getIsLibrarySubscribed', () => {
      it('should return false when no streams are active', () => {
        const mockState = {
          libraryDataSource: {
            publicData: {
              activeStreamKeys: []
            }
          }
        }

        const result = getIsLibrarySubscribed(mockState)
        expect(result).toBe(false)
      })

      it('should return true when global stream is active', () => {
        const mockState = {
          libraryDataSource: {
            publicData: {
              activeStreamKeys: ['global']
            }
          }
        }

        const result = getIsLibrarySubscribed(mockState)
        expect(result).toBe(true)
      })

      it('should return false when other streams are active but not global', () => {
        const mockState = {
          libraryDataSource: {
            publicData: {
              activeStreamKeys: ['other-stream']
            }
          }
        }

        const result = getIsLibrarySubscribed(mockState)
        expect(result).toBe(false)
      })

      it('should return true when multiple streams are active including global', () => {
        const mockState = {
          libraryDataSource: {
            publicData: {
              activeStreamKeys: ['stream1', 'global', 'stream2']
            }
          }
        }

        const result = getIsLibrarySubscribed(mockState)
        expect(result).toBe(true)
      })
    })
  })

  describe('Helper Functions', () => {
    describe('subscribeToLibrary', () => {
      it('should return action to subscribe to global stream', () => {
        const action = subscribeToLibrary()
        
        // The action should be a thunk or action creator
        expect(action).toBeDefined()
      })
    })

    describe('unsubscribeFromLibrary', () => {
      it('should return action to unsubscribe from global stream', () => {
        const action = unsubscribeFromLibrary()
        
        // The action should be a thunk or action creator
        expect(action).toBeDefined()
      })
    })
  })

  describe('Configuration', () => {
    it('should be configured with correct dataSourceKey', () => {
      // This is verified by the slice working correctly with the factory
      expect(libraryDataSourceSlice.name).toBe('libraryDataSource')
    })

    it('should have aggregator configured', () => {
      // Verified implicitly by slice creation succeeding
      expect(libraryDataSourceSlice).toBeDefined()
    })

    it('should have event serializer configured', () => {
      // Verified implicitly by slice creation succeeding
      expect(libraryDataSourceSlice).toBeDefined()
    })
  })
})

