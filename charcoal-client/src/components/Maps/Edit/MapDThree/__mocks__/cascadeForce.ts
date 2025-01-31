import { vi } from 'vitest'
export const cascadeForce = Object.assign(vi.fn(), {
    sourceNodes: vi.fn(),
    targetNodes: vi.fn(),
    id: vi.fn()
})

export default cascadeForce
