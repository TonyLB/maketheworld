class Debounce {
    _timeouts: Record<string, NodeJS.Timeout | number> = {};

    remove(key: string): void {
        if (key in this._timeouts) {
            clearTimeout(this._timeouts[key])
            delete this._timeouts[key]
        }
    }

    set(key: string, callback: () => void, delay: number): void {
        this.remove(key)
        this._timeouts[key] = setTimeout(() => {
            callback()
            this.remove(key)
        }, delay) ?? 1
    }

    clear(): void {
        Object.values(this._timeouts).forEach((timeout) => { if (timeout) { clearTimeout(timeout) } })
        this._timeouts = {}
    }
}

export default Debounce
