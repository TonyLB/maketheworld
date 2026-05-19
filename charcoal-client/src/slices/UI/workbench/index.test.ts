import { configureStore } from '@reduxjs/toolkit'
import thunk from 'redux-thunk'
import { combineReducers } from 'redux'
import { WorkbenchBreadcrumbEntry, setBreadcrumbStack, replaceTopBreadcrumb } from './index'
import {
    getCurrentView,
    getCurrentComponentId,
    getCurrentComponentLayerId,
    getNavigationTrail
} from './index'
import { RootState } from '../../../store'
import workbenchReducer from './index'

describe('workbench navigation selectors', () => {
    const baseState: RootState = {
        // @ts-expect-error partial RootState for selector testing
        UI: {
            workbench: {
                open: true,
                authoringMode: 'authoring',
                currentAssetId: 'ASSET#test',
                secondaryContext: null,
                breadcrumbStack: []
            }
        }
    }

    const withBreadcrumbs = (breadcrumbs: WorkbenchBreadcrumbEntry[]): RootState => ({
        ...baseState,
        UI: {
            ...baseState.UI,
            workbench: {
                ...baseState.UI.workbench,
                breadcrumbStack: breadcrumbs
            }
        }
    } as any)

    it('builds navigation trail by prepending the asset crumb', () => {
        const stack: WorkbenchBreadcrumbEntry[] = [
            { id: 'ROOM#one', kind: 'component', componentId: 'ROOM#one' }
        ]
        const state = withBreadcrumbs(stack)

        const trail = getNavigationTrail(state)
        expect(trail).toHaveLength(2)
        expect(trail[0]).toMatchObject({ id: 'ASSET#test', componentId: null })
        expect(trail[1]).toMatchObject({ id: 'ROOM#one', kind: 'component' })
    })

    it('derives view and component ids from asset → component', () => {
        const stack: WorkbenchBreadcrumbEntry[] = [
            { id: 'ROOM#one', kind: 'component', componentId: 'ROOM#one' }
        ]
        const state = withBreadcrumbs(stack)

        expect(getCurrentView(state)).toBe('component')
        expect(getCurrentComponentId(state)).toBe('ROOM#one')
        expect(getCurrentComponentLayerId(state)).toBeNull()
    })

    it('derives view and component ids from asset → component → component (uniform stack)', () => {
        const stack: WorkbenchBreadcrumbEntry[] = [
            { id: 'ROOM#one', kind: 'component', componentId: 'ROOM#one' },
            { id: 'SITUATION#one', kind: 'component', componentId: 'SITUATION#one' }
        ]
        const state = withBreadcrumbs(stack)
        // Without standardForm in state, getLayeredContext returns null so we get component view
        expect(getCurrentView(state)).toBe('component')
        expect(getCurrentComponentId(state)).toBe('SITUATION#one')
        expect(getCurrentComponentLayerId(state)).toBeNull()
    })

    it('replaceTopBreadcrumb replaces last stack entry with new id', () => {
        const store = configureStore({
            reducer: {
                UI: combineReducers({
                    workbench: workbenchReducer
                })
            },
            middleware: [thunk]
        })
        const stack: WorkbenchBreadcrumbEntry[] = [
            { id: 'ROOM#one', kind: 'component', componentId: 'ROOM#one' },
            { id: 'SITUATION#one', kind: 'component', componentId: 'SITUATION#one' }
        ]
        store.dispatch(setBreadcrumbStack(stack))
        store.dispatch(replaceTopBreadcrumb('SITUATION#two' as any))
        const result = store.getState().UI.workbench.breadcrumbStack
        expect(result).toHaveLength(2)
        expect(result[0]).toMatchObject({ id: 'ROOM#one', componentId: 'ROOM#one' })
        expect(result[1]).toMatchObject({ id: 'SITUATION#two', kind: 'component', componentId: 'SITUATION#two' })
    })
})

