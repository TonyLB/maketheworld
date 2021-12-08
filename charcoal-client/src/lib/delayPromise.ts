export const delayPromise = (delay: number) => {
    return new Promise<void>((resolve) => {
        setTimeout(() => { resolve() }, delay)
    })
}

export default delayPromise
