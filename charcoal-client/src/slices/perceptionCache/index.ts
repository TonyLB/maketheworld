import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { KnowledgeDescription, Message } from '@tonylb/mtw-interfaces/dist/messages'
import { PerceptionCacheKey, PerceptionCacheState } from './baseClasses'

const perceptionCacheSlice = createSlice({
    name: 'perceptionCache',
    initialState: {} as PerceptionCacheState,
    reducers: {
        receiveMessages: (state: any, action: PayloadAction<Message[]>) => {
            action.payload
                .filter((value): value is KnowledgeDescription => (value.DisplayProtocol === 'KnowledgeDescription'))
                .forEach(({ Target, MessageId, CreatedTime, DisplayProtocol, ...rest }) => {
                    //
                    // TODO: Evaluate whether there is any benefit to the currently unused ability to cache
                    // perceptions for individual characters (perhaps as a way to lift maps out of ActiveCharacter slice)
                    //
                    if (!Target) {
                        const cacheKey: PerceptionCacheKey = `${Target ?? 'ANONYMOUS'}::${rest.KnowledgeId}`
                        state[cacheKey] = rest
                    }
                })
        }
    }
})

export {
    getCachedPerception
} from './selectors'
export const { receiveMessages } = perceptionCacheSlice.actions
export default perceptionCacheSlice.reducer
