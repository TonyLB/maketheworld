import React, { FunctionComponent } from 'react'

import { PlayerAsset, PlayerCharacter } from '../../slices/player/baseClasses'

export type PreviewPaneProps = ({
    type: 'Asset'
} & PlayerAsset) | ({
    type: 'Character'
} & PlayerCharacter)

export const PreviewCharacter: FunctionComponent<PreviewPaneProps> = (props) => {
    switch(props.type) {
        default:
            return <div>
                Preview Pane
            </div>
    }
}

export default PreviewCharacter
