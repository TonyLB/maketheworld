import { WorkbenchBreadcrumbEntry } from './index'
import {
    getCurrentView,
    getCurrentComponentId,
    getCurrentComponentLayerId,
    getNavigationTrail
} from './index'
import { RootState } from '../../../store'

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

    it('derives view and layer id from asset → component → componentLayer', () => {
        const stack: WorkbenchBreadcrumbEntry[] = [
            { id: 'ROOM#one', kind: 'component', componentId: 'ROOM#one' },
            { id: 'EXAMPLE#one', kind: 'componentLayer', componentId: 'EXAMPLE#one' }
        ]
        const state = withBreadcrumbs(stack)

        expect(getCurrentView(state)).toBe('componentLayer')
        expect(getCurrentComponentId(state)).toBe('ROOM#one')
        expect(getCurrentComponentLayerId(state)).toBe('EXAMPLE#one')
    })
})

