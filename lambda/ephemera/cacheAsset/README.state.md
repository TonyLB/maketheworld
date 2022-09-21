---
---

# State Layer

The State layer stores data-derivatives for each asset that allow the manipulation of that asset's
internal state variables.

---

## Needs Addressed

- Need to be able to read and set variable values
- Need to be able to import variables from other assets
- Need to assure that when an imported variable is set, that change cascades to all assets that depend
upon the same variable (either directly or through a sequence of imports and renames)
- Need to be able to trace an imported variable to its original definition
- Need to be able to track all dependencies of a variable, in every import branching
- Need to be able to track all dependencies of component renders on a variable (through use in conditions)
in order to send render updates upon a variable change
- Need to be able to store actions which execute code to change the state

---

## State Storage

---

*Any asset will have a State property with a map of variables and computed items*

```ts
export type EphemeraStateComputed = {
    key: string;
    computed: true;
    src: string;
    value?: any;
}

export type EphemeraStateVariable = {
    key: string;
    computed?: false;
    imported?: false;
    value: any;
}

export type EphemeraStateImport = {
    key: string;
    computed?: false;
    imported: true;
    value: any;
    asset: string;
}

type EphemeraStateItem = EphemeraStateComputed | EphemeraStateVariable | EphemeraStateImport

export type EphemeraState = {
    [key: string]: EphemeraStateItem
}
```

***Transition to new storage***

*Any variable will have a per-asset row to represent how it is referenced in a particular asset,*
*with a Meta::Variable row representing the overall variable (including its value and descendants)*

```ts
export type EphemeraMetaVariableValue = string
    | boolean
    | Record<string, EphemeraMetaVariableValue>
    | EphemeraMetaVariableValue[]

export type EphemeraMetaVariable = {
    EphemeraId: string;
    DataCategory: 'Meta::Variable';
    value: EphemeraMetaVariableValue;
    descendants: any; // <TBD: Descendant layer>
}
```

*Any computed value will have a per-asset row to represent how it is referenced in a particular asset,*
*with a Meta::Computed row representing the overall variable (including its current value, source,*
*and descendants)*

```ts
export type EphemeraMetaComputed = {
    EphemeraId: string;
    DataCategory: 'Meta::Computed';
    src: string;
    descendants: any; // <TBD: Descendant layer>
}
```

---

## Action Storage

*Any action will have a per-asset row to represent how it is referenced in a particular asset,*
*with a Meta::Action row representing the overall action (including its source and root asset)*

```ts
export type EphemeraMetaAction = {
    EphemeraId: string;
    DataCategory: 'Meta::Action';
    src: string;
    rootAsset: string;
}
```

---

## Dependencies

*Any asset will have a Dependencies property with a map keyed by variable names, which lists various sorts of dependencies*

```ts
export type EphemeraDependencyImport = {
    key: string;
    asset: string;
}

export type EphemeraDependencies = {
    room?: string[];
    map?: string[];
    mapCache?: string[];
    computed?: string[];
    imported?: EphemeraDependencyImport[];
}
```

---
---