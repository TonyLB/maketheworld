import React, { FunctionComponent, useCallback, useMemo } from 'react'
import {
    useLocation,
    useNavigate,
    useParams
} from "react-router-dom"

import Box from '@mui/material/Box'
import HomeIcon from '@mui/icons-material/Home'

import LibraryBanner from './LibraryBanner'

import StandardLiteralEditor from './StandardLiteralEditor'
import { useLibraryAsset } from './LibraryAsset'
import DraftLockout from './DraftLockout'
import RoomExitEditor from './RoomExitEditor'
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { useDispatch } from 'react-redux'
import { rename as renameNavigationTab } from '../../../slices/UI/navigationTabs'

import TitledBox from '../../TitledBox'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { GenericTree, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import SchemaTagTree from '@tonylb/mtw-wml/ts/tagTree/schema'
import { unwrapSubject } from '@tonylb/mtw-wml/ts/schema/utils'
import { addOnboardingComplete } from '../../../slices/player/index.api'

import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { hasName, hasShortName, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { isSchemaAsset, isSchemaCharacter, isSchemaWithKey, SchemaOutputTag, SchemaTag, SchemaWithKey } from '@tonylb/mtw-base/ts/schema'
import { SchemaAssetTag, SchemaStoryTag } from '@tonylb/mtw-base/ts/schema/asset'
import { SchemaCharacterTag } from '@tonylb/mtw-base/ts/schema/character'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import ExampleEditor from './ExampleEditor'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'

const WMLComponentAppearance: FunctionComponent<{ ComponentId: string }> = ({ ComponentId }) => {
    const { standardForm, inheritedStandardForm, updateStandard } = useLibraryAsset()
    const [component, inherited]: [StandardFeature | StandardKnowledge | StandardRoom | undefined, StandardFeature | StandardKnowledge | StandardRoom | undefined] = useMemo(() => {
        const extractComponent = (standardForm: StandardForm): StandardFeature | StandardKnowledge | StandardRoom | undefined => {
            if (ComponentId) {
                const component = standardForm.byId[ComponentId]
                if (component && (component instanceof StandardFeature || component instanceof StandardKnowledge || component instanceof StandardRoom)) {
                    return component
                }
            }
            return undefined
        }
        return [extractComponent(standardForm), extractComponent(new StandardForm(inheritedStandardForm))]
    }, [ComponentId, standardForm, inheritedStandardForm])
    const { tag } = component ?? {}
    useOnboardingCheckpoint('navigateRoom', { requireSequence: true, condition: tag === 'Room' })
    useOnboardingCheckpoint('navigateAssetWithImport', { requireSequence: true })

    return component ? <Box sx={{
        marginLeft: '0.5em',
        marginTop: '0.5em',
        display: 'flex',
        flexDirection: 'column',
        rowGap: '0.25em',
        width: "calc(100% - 0.5em)",
        position: 'relative'
    }}>
        {
            hasShortName(component) && (
                <TitledBox title="Short Name">
                    <StandardLiteralEditor
                        value={component.shortName}
                        onChange={(newShortName) => {
                            updateStandard({
                                type: 'update',
                                update: (incoming: StandardForm) => {
                                    const base = incoming.byId[ComponentId]
                                    if (base instanceof StandardRoom || base instanceof StandardCharacter) {
                                        base._payload._shortName = newShortName
                                    }
                                    return incoming
                                }
                            })
                        }}
                        placeholder="Enter short name..."
                        size="small"
                    />
                </TitledBox>
            )
        }
        {
            (component.examples.map(({ key }) => (<ExampleEditor key={key} componentId={`${component.key}.${key}`} />)))
        }
        {
            (component instanceof StandardRoom) && <RoomExitEditor RoomId={ComponentId || ''} onChange={() => {}} />
        }
    </Box>
    : <Box />
}

interface WMLComponentDetailProps {
}

export const WMLComponentDetail: FunctionComponent<WMLComponentDetailProps> = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { assetKey, updateStandard, standardForm } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const location = useLocation()
    const tag = location.pathname.split('/').slice(-2)[0]
    const componentName = useMemo(() => {
        const component = standardForm.byId[ComponentId ?? '']
        if (component) {
            if (hasShortName(component)) {
                return component.shortName?._payload?.plain?.toJSON() ?? 'Untitled'
            }
            else if (hasName(component)) {
                return schemaOutputToString((unwrapSubject(component.name)?.children ?? []) as GenericTree<SchemaOutputTag>)
            }
        }
        return ''
    }, [standardForm, ComponentId])
    useAutoPin({
        href: `${(assetKey ?? 'draft') === 'draft' ? '/Draft/' : `/Library/Edit/Asset/${assetKey}/`}${tag}/${ComponentId}`,
        label: componentName || 'Untitled',
        type: 'ComponentEdit',
        iconName: 'Room',
        assetId: `ASSET#${assetKey}`,
        componentId: ComponentId || ''
    })
    const onKeyChange = useCallback((toKey: string) => {
        updateStandard({
            type: 'renameKey',
            from: ComponentId ?? '',
            to: toKey
        })
        dispatch(renameNavigationTab({
            fromHRef: `/Library/Edit/Asset/${assetKey}/${tag}/${ComponentId}`,
            toHRef: `/Library/Edit/Asset/${assetKey}/${tag}/${toKey}`,
            componentId: toKey
        }))
        navigate(`/Library/Edit/Asset/${assetKey}/${tag}/${toKey}`)
    }, [updateStandard, ComponentId, navigate, assetKey, dispatch, tag])
    const allExportKeys = useMemo(() => {
        const tagTree = new SchemaTagTree(standardForm.metaData)
            .filter({ match: 'Export' })
            .prune({ match: 'Export' })
        const exportMappings: Record<string, string> = Object.assign({}, ...tagTree.tree.map((node) => {
            const isSchemaWithKeyOtherThanAsset = (data: SchemaTag): data is Exclude<SchemaWithKey, SchemaAssetTag | SchemaStoryTag | SchemaCharacterTag> => (isSchemaWithKey(data) && !(isSchemaAsset(data) || isSchemaCharacter(data)))
            if (treeNodeTypeguard(isSchemaWithKeyOtherThanAsset)(node)) {
                return { [node.data.key]: node.data.as ?? node.data.key }
            }
            else {
                return {}
            }
        }))
        return Object.keys(standardForm.byId).map((key) => (exportMappings[key] ?? key))
    }, [standardForm])
    const nameValidate = useCallback((toKey: string) => (!(toKey !== ComponentId && (allExportKeys.includes(toKey)))), [ComponentId, allExportKeys])
    if (!(ComponentId && ComponentId in standardForm.byId)) {
        return <Box />
    }
    return <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <LibraryBanner
            primary={componentName}
            secondary={ComponentId}
            onChangeSecondary={onKeyChange}
            validateSecondary={nameValidate}
            icon={<HomeIcon />}
            breadCrumbProps={[{
                href: '/Library',
                label: 'Library'
            },
            {
                href: `/Library/Edit/Asset/${assetKey}`,
                label: assetKey || ''
            },
            {
                label: componentName
            }]}
        />
        <Box sx={{ flexGrow: 1, position: "relative", width: "100%" }}>
            <Box sx={{ overflowY: 'auto' }}>
                <WMLComponentAppearance ComponentId={ComponentId} />
            </Box>
            <DraftLockout />
        </Box>
    </Box>
}

export default WMLComponentDetail
