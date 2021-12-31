import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { v4 as uuidv4 } from 'uuid'

//
// ssmHeartbeat is a very simple slice that merely gives an outlet
// to tick a timer which, in turn, the useSSM hook takes as a sign
// to iterate all SSMs.  This back and forth creates the ongoing
// behavior of all the stateSeekingMachines
//

interface HeartbeatSlice {
    heartbeat: string
}

const initialState: HeartbeatSlice = { heartbeat: '' }

export const ssmHeartbeat = createSlice({
    name: 'ssmHeartbeat',
    initialState,
    reducers: {
        setHeartbeat: (state, action: PayloadAction<string>) => {
            state.heartbeat = action.payload
        }
    }
})

export const getHeartbeat = (state: any) => {
    return state.ssmHeartbeat.heartbeat
}

//
// Each new heartbeat should be random ... since any heartbeat that
// doesn't do productive work will happen nigh-instantaneously, there
// is no point in trying to second-guess when to issue one.  It only
// leads to undebuggable race conditions.
//
// TODO: Figure out how to configure redux devtools in the source code
// so that it filters out heartbeat actions in the Redux browser devtool
// (to reduce visual clutter)
//
export const heartbeat = (dispatch: any, getState: any) => {
    const heartbeat = uuidv4()
    dispatch(ssmHeartbeat.actions.setHeartbeat(heartbeat))
}

export default ssmHeartbeat.reducer
