import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { vi } from "vitest"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { LensHeader } from "./LensHeader"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"

const ROOM_ID = "ROOM#room1" as ComponentUUID
const LENS_ID = "LENS#lens1" as ComponentUUID

const updateStandardMock = vi.fn()
let mockWorkbenchReturn: ReturnType<typeof import("../foundations/useWorkbenchAsset").useWorkbenchAsset> = {
    standardForm: new StandardForm({ universalKey: "ASSET#test", components: [], metaData: [] }),
    updateStandard: updateStandardMock,
    readonly: false,
    AssetId: "ASSET#test"
} as any

vi.mock("../foundations/useWorkbenchAsset", () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

vi.mock("../ImportComponentDialog", () => ({
    default: () => null
}))

const createStore = () =>
    configureStore({
        reducer: {
            UI: (state = { workbench: { breadcrumbStack: [] } }) => state
        }
    })

function renderWithStore(ui: React.ReactElement) {
    const store = createStore()
    return {
        ...render(<Provider store={store}>{ui}</Provider>),
        store
    }
}

describe("LensHeader", () => {
    beforeEach(() => {
        updateStandardMock.mockClear()
        mockWorkbenchReturn = {
            standardForm: new StandardForm({ universalKey: "ASSET#test", components: [], metaData: [] }),
            updateStandard: updateStandardMock,
            readonly: false,
            AssetId: "ASSET#test"
        } as any
    })

    it("shows Room not found when RoomId is not in standardForm", () => {
        mockWorkbenchReturn.standardForm = new StandardForm({
            universalKey: "ASSET#test",
            components: [],
            metaData: []
        })
        renderWithStore(<LensHeader RoomId={ROOM_ID} />)
        expect(screen.getByText("Room not found")).toBeTruthy()
    })

    it("shows Create New Lens, Reference Existing Lens, and Import Lens when room has no lens", () => {
        mockWorkbenchReturn.standardForm = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><ShortName>R1</ShortName></Room>
            </Asset>
        `)
        renderWithStore(<LensHeader RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByRole("button", { name: /Dynamic Rendering/i }))
        expect(screen.getByText("Create New Lens")).toBeTruthy()
        expect(screen.getByText("Reference Existing Lens")).toBeTruthy()
        expect(screen.getByText("Import Lens")).toBeTruthy()
    })

    it("calls updateStandard when Create New Lens is clicked", () => {
        mockWorkbenchReturn.standardForm = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><ShortName>R1</ShortName></Room>
            </Asset>
        `)
        renderWithStore(<LensHeader RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByRole("button", { name: /Dynamic Rendering/i }))
        fireEvent.click(screen.getByRole("button", { name: /Create New Lens/i }))
        expect(updateStandardMock).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "update",
                update: expect.any(Function)
            })
        )
    })

    it("shows lens summary and Edit/Delete when room has a lens", () => {
        mockWorkbenchReturn.standardForm = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
                <Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens>
            </Asset>
        `)
        const onEditLens = vi.fn()
        renderWithStore(<LensHeader RoomId={ROOM_ID} onEditLens={onEditLens} />)
        expect(screen.getByText("My Lens")).toBeTruthy()
        const editButton = screen.getByLabelText("Edit Lens")
        fireEvent.click(editButton)
        expect(onEditLens).toHaveBeenCalledWith(LENS_ID)
    })

    it("shows fallback label when lens has no short name", () => {
        mockWorkbenchReturn.standardForm = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
                <Lens uuid=(lens1)></Lens>
            </Asset>
        `)
        renderWithStore(<LensHeader RoomId={ROOM_ID} />)
        expect(screen.getByText("Lens (no short name)")).toBeTruthy()
    })

    it("disables action buttons when readonly", () => {
        mockWorkbenchReturn.standardForm = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><ShortName>R1</ShortName></Room>
            </Asset>
        `)
        mockWorkbenchReturn.readonly = true
        renderWithStore(<LensHeader RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByRole("button", { name: /Dynamic Rendering/i }))
        const createButton = screen.getByRole("button", { name: /Create New Lens/i })
        expect(createButton.getAttribute("aria-disabled")).toBe("true")
    })

    it("removes Lens component when Delete Lens reference is clicked and Lens is pure child of Room", () => {
        const formWithNestedLens = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens></Room>
            </Asset>
        `)
        mockWorkbenchReturn.standardForm = formWithNestedLens
        renderWithStore(<LensHeader RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByLabelText("Delete Lens reference"))

        expect(updateStandardMock).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "update",
                update: expect.any(Function)
            })
        )
        const updateFn = updateStandardMock.mock.calls[0][0].update
        const draft = formWithNestedLens._clone()
        const result = updateFn(draft)

        expect(result._components.find((c) => c.universalKey === LENS_ID)).toBeUndefined()
    })

    it("keeps Lens component when Delete Lens reference is clicked and Lens is in topLevel", () => {
        const formWithTopLevelLens = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
                <Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens>
            </Asset>
        `)
        mockWorkbenchReturn.standardForm = formWithTopLevelLens
        renderWithStore(<LensHeader RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByLabelText("Delete Lens reference"))

        const updateFn = updateStandardMock.mock.calls[0][0].update
        const draft = formWithTopLevelLens._clone()
        const result = updateFn(draft)

        expect(result._components.find((c) => c.universalKey === LENS_ID)).toBeDefined()
    })

    it("keeps Lens component when Delete Lens reference is clicked but Lens has another referrer", () => {
        const formWithSharedLens = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
                <Room uuid=(room2)><ShortName>R2</ShortName><Lens uuid=(lens1)/></Room>
                <Lens uuid=(lens1)><ShortName>Shared Lens</ShortName></Lens>
            </Asset>
        `)
        mockWorkbenchReturn.standardForm = formWithSharedLens
        renderWithStore(<LensHeader RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByLabelText("Delete Lens reference"))

        const updateFn = updateStandardMock.mock.calls[0][0].update
        const draft = formWithSharedLens._clone()
        const result = updateFn(draft)

        expect(result._components.find((c) => c.universalKey === LENS_ID)).toBeDefined()
    })
})
