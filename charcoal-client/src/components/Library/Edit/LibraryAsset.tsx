/** @jsxImportSource @emotion/react */

//
// LibraryAsset is a context provider (with associated useLibraryAsset
// context subscriber hook) to create component nests that all operate in the
// context of having a chosen asset that a player is examining in the library.
//
// Arguments:
//
//   - AssetId: The internal key of the asset.
//
// Context provided:
//
//   - AssetId
//

import React, { useContext, ReactChild, ReactChildren, FunctionComponent, useMemo, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import {
    getCurrentWML,
    getNormalized,
    getWMLQuery,
    getDefaultAppearances,
    getInheritedExits,
    setCurrentWML,
    setIntent
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { WMLQuery } from '../../../wml/wmlQuery'
import { NormalForm, NormalComponent, ComponentAppearance, ComponentRenderItem, NormalExit, isNormalExit, isNormalComponent } from '../../../wml/normalize'
import { InheritedExit, InheritedComponent } from '../../../slices/personalAssets/inheritedData'
import { objectFilter } from '../../../lib/objects'

type LibraryAssetContextType = {
    assetKey: string;
    AssetId: string;
    currentWML: string;
    normalForm: NormalForm;
    defaultAppearances: Record<string, InheritedComponent>;
    wmlQuery: WMLQuery;
    updateWML: (value: string, options?: { prettyPrint?: boolean }) => void;
    components: Record<string, AssetComponent>;
    rooms: Record<string, AssetComponent>;
    exits: Record<string, NormalExit>;
    inheritedExits: InheritedExit[];
    features: Record<string, AssetComponent>;
    save: () => void;
}

const LibraryAssetContext = React.createContext<LibraryAssetContextType>({
    assetKey: '',
    AssetId: '',
    currentWML: '',
    normalForm: {},
    defaultAppearances: {},
    wmlQuery: new WMLQuery(''),
    updateWML: () => {},
    components: {},
    rooms: {},
    exits: {},
    inheritedExits: [],
    features: {},
    save: () => {}
})

type LibraryAssetProps = {
    assetKey: string;
    children?: ReactChild | ReactChildren;
    character?: boolean;
}

export type AssetComponent = {
    tag: string;
    localName: string;
    localRender: ComponentRenderItem[];
    defaultName: string;
    defaultRender?: ComponentRenderItem[];
    name: string;
    render: ComponentRenderItem[];
    spaceBefore?: boolean;
    spaceAfter?: boolean;
}

const assetComponents = ({ normalForm, defaultAppearances }: { normalForm: NormalForm, defaultAppearances: Record<string, InheritedComponent> }): Record<string, AssetComponent> => {
    const componentNormals = Object.values(normalForm).filter((item) => (isNormalComponent(item))) as NormalComponent[]

    const roomReturns = componentNormals
        .map((component) => {
            const localName = (component.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                .map(({ name = '' }) => name)
                .join('')) || ''
            const countRenderAppearances = component.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                .length
            const localRender = component.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                .map(({ render = [] }) => render)
                .reduce((previous, render) => ([ ...previous, ...render ]), [])
            const spaceBefore = countRenderAppearances
                ? component.appearances
                    .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                    .map(({ spaceBefore = false }) => spaceBefore)
                    .reduce((previous, spaceBefore) => (previous || spaceBefore), false)
                : undefined
            const spaceAfter = countRenderAppearances
                ? component.appearances
                    .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
                    .map(({ spaceAfter = false }) => spaceAfter)
                    .reduce((previous, spaceAfter) => (previous || spaceAfter), false)
                : undefined
            const defaultName = defaultAppearances[component.key]?.name || ''
            const defaultRender = defaultAppearances[component.key]?.render
            return { [component.key]: {
                tag: component.tag,
                localName,
                localRender,
                defaultName,
                defaultRender,
                spaceBefore,
                spaceAfter,
                name: `${defaultName}${localName}`,
                render: [...(defaultRender || []), ...localRender]
            }}
        })
    
    return Object.assign({}, ...roomReturns)
}

export const LibraryAsset: FunctionComponent<LibraryAssetProps> = ({ assetKey, children, character }) => {

    const AssetId = `${character ? 'CHARACTER' : 'ASSET'}#${assetKey}`
    const currentWML = useSelector(getCurrentWML(AssetId))
    const normalForm = useSelector(getNormalized(AssetId))
    const wmlQuery = useSelector(getWMLQuery(AssetId))
    const defaultAppearances = useSelector(getDefaultAppearances(AssetId))
    const inheritedExits = useSelector(getInheritedExits(AssetId))
    const dispatch = useDispatch()
    const updateWML = (value: string, options?: { prettyPrint?: boolean }) => {
        const { prettyPrint = true } = options || {}
        if (prettyPrint) {
            const wmlQuery = new WMLQuery(value)
            const prettyPrinted = wmlQuery.prettyPrint().source
            dispatch(setCurrentWML(AssetId)({ value: prettyPrinted }))
        }
        else {
            dispatch(setCurrentWML(AssetId)({ value }))
        }
    }
    const components = useMemo<Record<string, AssetComponent>>(() => ( assetComponents({ normalForm, defaultAppearances }) ), [normalForm, defaultAppearances])
    const rooms = useMemo<Record<string, AssetComponent>>(() => ( objectFilter(components, ({ tag }) => (tag === 'Room')) ), [components])
    const exits = useMemo<Record<string, NormalExit>>(() => ( objectFilter(normalForm, isNormalExit) ), [components])
    const features = useMemo<Record<string, AssetComponent>>(() => ( objectFilter(components, ({ tag }) => (tag === 'Feature')) ), [components])
    const save = useCallback(() => {
        dispatch(setIntent({ key: AssetId, intent: ['NEEDSAVE'] }))
        dispatch(heartbeat)
    }, [dispatch, AssetId])

    return (
        <LibraryAssetContext.Provider value={{
            assetKey,
            AssetId,
            currentWML,
            normalForm,
            defaultAppearances,
            inheritedExits,
            wmlQuery,
            updateWML,
            components,
            rooms,
            exits,
            features,
            save
        }}>
            {children}
        </LibraryAssetContext.Provider>
    )
}

export const useLibraryAsset = () => (useContext(LibraryAssetContext))

export default LibraryAsset
