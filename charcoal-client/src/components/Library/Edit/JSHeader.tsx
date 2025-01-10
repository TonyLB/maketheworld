import React, { ReactElement, useMemo } from 'react'

import CalculateIcon from '@mui/icons-material/Calculate'
import { Box, ListItem, ListItemIcon, SxProps, Typography } from '@mui/material'

import { useLibraryAsset } from './LibraryAsset'
import { JSEdit } from './JSEdit'
import { StandardAction } from '@tonylb/mtw-wml/ts/standardize/components/action'
import { StandardComputed } from '@tonylb/mtw-wml/ts/standardize/components/computed'
import { StandardVariable } from '@tonylb/mtw-wml/ts/standardize/components/variable'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

type JSTags = StandardAction | StandardComputed | StandardVariable

type JSHeaderProps<T extends JSTags> = {
    item: T;
    getJS: (item: T) => string;
    maxHeight?: string;
    sx?: SxProps;
    selected?: boolean;
}

const JSHeader = <T extends JSTags>({ item, getJS, maxHeight }: JSHeaderProps<T>): ReactElement<any, any> | null => {
    const { updateStandard, readonly } = useLibraryAsset()
    const src = useMemo<string>(() => (getJS(item)), [item, getJS])

    return <ListItem>
        <ListItemIcon>
            <CalculateIcon />
        </ListItemIcon>
        <Box sx={{ padding: '2px', display: 'flex', width: "100%", position: "relative" }}>
            <Box sx={{ flexGrow: 2, flexShrink: 2, width: "0px", alignItems: "center", display: "inline-flex" }}>
                <Typography>{ item?.key }</Typography>
            </Box>
            <Box sx={{ flexGrow: 3, flexShrink: 3, width: "0px" }}>
                <JSEdit
                    src={src}
                    onChange={(value) => {
                        if (['Action', 'Computed'].includes(item.tag)) {
                            updateStandard({
                                type: 'updateComponent',
                                componentKey: item.key,
                                update: (incoming: StandardComponent) => {
                                    const base = incoming.clone()
                                    if (base instanceof StandardAction || base instanceof StandardComputed) {
                                        base._payload._src = value
                                    }
                                    return base
                                }
                            })                            
                        }
                        if (item.tag === 'Variable') {
                            updateStandard({
                                type: 'updateComponent',
                                componentKey: item.key,
                                update: (incoming: StandardComponent) => {
                                    const base = incoming.clone()
                                    if (base instanceof StandardVariable) {
                                        base._payload._default = value
                                    }
                                    return base
                                }
                            })
                        }
                    }}
                    maxHeight={maxHeight}
                    readonly={readonly}
                />
            </Box>
        </Box>

    </ListItem>
}

export default JSHeader
