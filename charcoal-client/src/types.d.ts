declare module 'is-hotkey' {
    type HotKeyPredicate = (event: KeyboardEvent | import('react').KeyboardEvent) => boolean;

    function isHotkey(hotkey: string | string[], event: KeyboardEvent | import('react').KeyboardEvent): boolean;
    function isHotkey(hotkey: string | string[]): HotKeyPredicate;

    export = isHotkey;
}
