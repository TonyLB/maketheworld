import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Message, PerceptionMessage } from '@tonylb/mtw-interfaces/ts/messages'
import { PerceptionCacheKey, PerceptionCacheState } from './baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { defaultComponentFromTag } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { splitType } from '@tonylb/mtw-utilities/ts/types'

// Enhanced message type with parsed WML
type EnhancedPerceptionMessage = PerceptionMessage & { parsedWML: StandardForm }

const perceptionCacheSlice = createSlice({
    name: 'perceptionCache',
    initialState: {} as Record<PerceptionCacheKey, EnhancedPerceptionMessage>,
    reducers: {
        receiveMessages: (state: any, action: PayloadAction<Message[]>) => {
            action.payload
                .filter((value): value is PerceptionMessage => (value.DisplayProtocol === 'PerceptionMessage'))
                .forEach((message) => {
                    // Process PerceptionMessage with WML parsing
                    const enhancedMessage = processPerceptionMessage(message)

                    // The Target field may not be included in the message payload itself,
                    // so we cache all PerceptionMessages for anonymous access
                    const componentUUID = message.metaData.componentUUID
                    const cacheKey: PerceptionCacheKey = `ANONYMOUS::${componentUUID}`
                    state[cacheKey] = enhancedMessage
                })
        },
        clear: (state: any) => {
            state = {}
        }
    }
})

// Helper function to process PerceptionMessage with WML parsing
const processPerceptionMessage = (message: PerceptionMessage): EnhancedPerceptionMessage => {
    try {
        const standardForm = new StandardForm(message.wmlContent, { standardizeMode: 'ephemeraWire' })
        return {
            ...message,
            parsedWML: standardForm
        }
    } catch (error) {
        console.warn('Failed to parse WML content for PerceptionMessage:', error)
        // Create a fallback StandardForm to prevent perpetual loading state
        const componentUUID = message.metaData.componentUUID
        const [upperTag] = splitType(componentUUID)
        const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`
        
        // Create a proper fallback StandardForm with the correct component type
        const fallbackForm = new StandardForm('fallback')
        const defaultData = defaultComponentFromTag(tag as any, 'fallback', componentUUID)
        const { component: fallbackComponent } = standardComponentFactory(defaultData)
        
        if (fallbackComponent) {
            fallbackForm._components = [fallbackComponent]
        }
        
        return {
            ...message,
            parsedWML: fallbackForm
        }
    }
}

export {
    getCachedPerception
} from './selectors'
export const { receiveMessages, clear } = perceptionCacheSlice.actions
export default perceptionCacheSlice.reducer
