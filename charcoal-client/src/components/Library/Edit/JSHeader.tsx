import { ReactElement, useMemo } from 'react'

import CalculateIcon from '@mui/icons-material/Calculate'
import { Box, ListItem, ListItemIcon, SxProps, Typography } from '@mui/material'

import { useLibraryAsset } from './LibraryAsset';
import { NormalAction, NormalComputed, NormalVariable } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { JSEdit } from './JSEdit'
import { SchemaTag } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses';

type JSTags = NormalAction | NormalComputed | NormalVariable

type JSHeaderProps<T extends JSTags, V extends T> = {
    item: T;
    typeGuard: (item: T) => item is V;
    getJS: (item: V) => string;
    schema: (key: string, value: string) => SchemaTag;
    onClick: () => void;
    maxHeight?: string;
    sx?: SxProps;
    selected?: boolean;
}

const JSHeader = <T extends JSTags, V extends T>({ item, typeGuard, getJS, schema, maxHeight, onClick }: JSHeaderProps<T, V>, context?: any): ReactElement<any, any> | null => {
    const { updateNormal, readonly } = useLibraryAsset()
    const definingAppearance = useMemo<number>(() => ((item.appearances || []).findIndex(({ contextStack }) => (contextStack.every(({ tag }) => (['Asset', 'Character'].includes(tag)))))), [item])
    const src = useMemo<string>(() => (
        typeGuard(item)
            ? getJS(item)
            : ''
    ), [item, getJS, typeGuard])

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
                        if (definingAppearance >= -1) {
                            updateNormal({
                                type: 'put',
                                item: schema(item.key, value),
                                reference: {
                                    key: item.key,
                                    tag: item.tag,
                                    index: definingAppearance
                                },
                                replace: true
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
