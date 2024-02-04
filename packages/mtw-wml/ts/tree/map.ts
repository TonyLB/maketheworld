import { GenericTree } from "./baseClasses";

type TreeMapCallback = (incoming) => typeof incoming extends { data, children } ? typeof incoming["children"] : never

export const map = <Callback extends TreeMapCallback>(tree: GenericTree<Parameters<Callback>[0]["data"], Omit<Parameters<Callback>[0], 'data' | 'children'>>, callback: Callback): ReturnType<Callback> => {
    return tree.map(({ data, children, ...rest }) => (callback({ data, children: map(children, callback), ...rest }))).flat(1) as ReturnType<Callback>
}

type TreeMapCallbackAsync = (incoming) => typeof incoming extends { data, children } ? Promise<typeof incoming["children"]> : never
type CallbackReturnPromise<Callback extends TreeMapCallbackAsync> = ReturnType<Callback> extends Promise<any> ? ReturnType<Callback> : never

export const asyncMap = <Callback extends TreeMapCallbackAsync>(tree: GenericTree<Parameters<Callback>[0]["data"], Omit<Parameters<Callback>[0], 'data' | 'children'>>, callback: Callback): CallbackReturnPromise<Callback> => {
    return Promise.all(tree.map(async ({ data, children, ...rest }) => (await callback({ data, children: await asyncMap(children, callback), ...rest })))).then((value) => (value.flat(1))) as CallbackReturnPromise<Callback>
}
