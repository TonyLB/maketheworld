import { describe, it, expect } from 'vitest'
import { 
  contentHeadersSlice, 
  contentHeadersSelectors, 
  contentHeadersActions,
  iterateContentHeaders 
} from './index'

describe('contentHeaders slice', () => {
  it('should create slice with correct name', () => {
    expect(contentHeadersSlice.name).toBe('contentHeaders')
    expect(contentHeadersSlice.reducer).toBeDefined()
  })

  it('should have correct initial state', () => {
    const initialState = contentHeadersSlice.getInitialState()
    
    expect(initialState.meta.currentState).toBe('INITIAL')
    expect(initialState.publicData.activeStreamKeys).toEqual([])
    expect(initialState.publicData.subscribedStreams).toEqual({})
  })

  it('should provide selectors', () => {
    expect(contentHeadersSelectors.getActiveStreamKeys).toBeDefined()
    expect(contentHeadersSelectors.getSubscribedStreams).toBeDefined()
  })

  it('should provide public actions', () => {
    expect(contentHeadersActions.processEnvelope).toBeDefined()
  })

  it('should provide iterator', () => {
    expect(iterateContentHeaders).toBeDefined()
  })

  it('should have state machine actions', () => {
    expect(contentHeadersSlice.actions.setIntent).toBeDefined()
    expect(contentHeadersSlice.actions.internalStateChange).toBeDefined()
  })
})

