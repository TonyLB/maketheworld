/** @jsxImportSource @emotion/react */
import React, { useCallback, useEffect, FunctionComponent } from 'react'
import { css } from '@emotion/react'
import { useDispatch } from 'react-redux'

import VirtualMessageList from './VirtualMessageList'
import { parseCommand } from '../../slices/lifeLine'
import LineEntry from '../LineEntry'
import { useActiveCharacter } from '../ActiveCharacter'
import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'
import { addItem } from '../../slices/activeCharacters'
import { heartbeat } from '../../slices/stateSeekingMachine/ssmHeartbeat'

export const MessagePanel: FunctionComponent<{}> = () => {
    const dispatch = useDispatch()
    const { CharacterId, info: { Name = '???' } = {} } = useActiveCharacter()
    useAutoPin({ href: `/Character/${CharacterId}/Play`, label: `Play: ${Name}`})
    useEffect(() => {
        dispatch(addItem(CharacterId))
        dispatch(heartbeat)
    }, [dispatch, CharacterId])
    const handleInput = useCallback((entry) => {
        dispatch(parseCommand(CharacterId)({ entry, raiseError: () => {} }))
        return true
    }, [dispatch, CharacterId])
    return <div css={css`
            display: grid;
            height: 100%;
            position: relative;
            grid-template-columns: 1fr;
            grid-template-rows: 1fr auto;
            grid-template-areas:
                "messages"
                "input"
        `}>
            <div css={css`
                grid-area: 'messages';
                position: relative
            `}>
                <VirtualMessageList />
            </div>
            <div css={css`
                grid-area: 'input';
                width: 100%;
            `}>
                <LineEntry callback={handleInput} />
            </div>
        </div>

}

export default MessagePanel
