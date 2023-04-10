import { FunctionComponent, useMemo } from 'react'

import CalculateIcon from '@mui/icons-material/Calculate'
import { Box, ListItem, ListItemIcon, SxProps, Typography } from '@mui/material'

import { useLibraryAsset } from './LibraryAsset';
import { isNormalComputed } from '@tonylb/mtw-wml/dist/normalize/baseClasses';
import { JSEdit } from './JSEdit';
import { extractDependenciesFromJS } from '@tonylb/mtw-wml/dist/convert/utils';

interface ComputedHeaderProps {
    ItemId: string;
    onClick: () => void;
    sx?: SxProps;
    selected?: boolean;
}

const ComputedHeaderInterior: FunctionComponent<ComputedHeaderProps> = ({ ItemId, onClick, sx, selected }) => {
    const { normalForm, updateNormal, importData, rooms } = useLibraryAsset()
    const item = useMemo(() => (normalForm[ItemId]), [normalForm, ItemId])
    const definingAppearance = useMemo<number>(() => ((item.appearances || []).findIndex(({ contextStack }) => (contextStack.every(({ tag }) => (['Asset', 'Character'].includes(tag)))))), [item])
    const src = isNormalComputed(item)
        ? item.src
        : ''

    return <ListItem>
        <ListItemIcon>
            <CalculateIcon />
        </ListItemIcon>
        <Box sx={{ padding: '2px', display: 'flex', width: "100%", position: "relative" }}>
            <Box sx={{ flexGrow: 2, flexShrink: 2, width: "0px" }}>
                <Typography>{ item?.key }</Typography>
            </Box>
            <Box sx={{ flexGrow: 3, flexShrink: 3, width: "0px" }}>
                <JSEdit
                    src={src}
                    onChange={(value) => {
                        if (definingAppearance >= -1) {
                            updateNormal({
                                type: 'put',
                                item: {
                                    key: ItemId,
                                    tag: 'Computed',
                                    src: value,
                                    dependencies: extractDependenciesFromJS(value)
                                },
                                reference: {
                                    key: ItemId,
                                    tag: 'Computed',
                                    index: definingAppearance
                                },
                                replace: true
                            })    
                        }
                    }}
                />
            </Box>
        </Box>

    </ListItem>
}

export const ComputedHeader: FunctionComponent<ComputedHeaderProps> = (props) => {
    return <ComputedHeaderInterior {...props} />
}

export default ComputedHeader
