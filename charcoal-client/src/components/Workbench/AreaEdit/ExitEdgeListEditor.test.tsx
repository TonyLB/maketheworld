/**
 * @vitest-environment jsdom
 */

import React, { useCallback, useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import ExitEdgeListEditor from './ExitEdgeListEditor'

const AREA_ID = 'AREA#district' as ComponentUUID
const EMPTY_AREA_ID = 'AREA#empty' as ComponentUUID

const districtWml = deIndentWML(`
    <Asset uuid=(test)>
        <Area uuid=(AREA#district) key=(district)>
            <ShortName>District</ShortName>
            <Room uuid=(ROOM#highway) />
            <Room uuid=(ROOM#town) />
        </Area>
        <Room uuid=(ROOM#highway) key=(highway)><ShortName>Highway</ShortName></Room>
        <Room uuid=(ROOM#town) key=(town)><ShortName>Town</ShortName></Room>
    </Asset>
`)

const emptyAreaWml = deIndentWML(`
    <Asset uuid=(test)>
        <Area uuid=(AREA#empty) key=(empty) />
        <Room uuid=(ROOM#a) />
    </Asset>
`)

let mockWorkbenchReturn: {
    standardForm: StandardForm
    readonly: boolean
    updateStandard: ReturnType<typeof vi.fn>
    AssetId: ComponentUUID
}

vi.mock('../foundations/useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

type TestHostProps = {
    initialWml: string
    areaId: ComponentUUID
}

function TestHost({ initialWml, areaId }: TestHostProps) {
    const [form, setForm] = useState(() => new StandardForm(initialWml))

    const updateStandard = useCallback(
        (action: { type: string; update?: (draft: StandardForm) => StandardForm }) => {
            if (action.type === 'update' && action.update) {
                setForm((prev) => {
                    const draft = prev._clone()
                    return action.update!(draft) ?? draft
                })
            }
        },
        []
    )

    mockWorkbenchReturn = {
        standardForm: form,
        readonly: false,
        updateStandard: vi.fn(updateStandard),
        AssetId: 'ASSET#test' as ComponentUUID
    }

    return <ExitEdgeListEditor AreaId={areaId} />
}

describe('ExitEdgeListEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const expandExitEdges = () => {
        fireEvent.click(screen.getByRole('button', { name: 'Exit edges' }))
    }

    const clickAddExitEdge = () => {
        fireEvent.click(screen.getByText('Add exit edge'))
    }

    it('creates a stub row with unset endpoints when Add exit edge is clicked', () => {
        render(<TestHost initialWml={districtWml} areaId={AREA_ID} />)
        expandExitEdges()

        clickAddExitEdge()

        expect(screen.getByRole('button', { name: /From: \(unset\)/i })).toBeTruthy()
        expect(screen.getByRole('button', { name: /To: \(unset\)/i })).toBeTruthy()
        expect(screen.getByLabelText('Back')).toBeTruthy()
        expect(screen.getByLabelText('Forward')).toBeTruthy()
    })

    it('allows add when Area has zero participants', () => {
        render(<TestHost initialWml={emptyAreaWml} areaId={EMPTY_AREA_ID} />)
        expandExitEdges()

        clickAddExitEdge()

        expect(screen.getByRole('button', { name: /From: \(unset\)/i })).toBeTruthy()
        expect(screen.getByRole('button', { name: /To: \(unset\)/i })).toBeTruthy()
    })
})
