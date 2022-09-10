---
---

# EventBridge bus

The lambda functions that make up the system communicate internally using an EventBridge bus
which lets them push small messages for other lambdas to respond to.

---

## Needs Addressed

---

***Separation of Concerns***
- Each lambda should be the sole proprietor of its associated data, with the only joint sources
of truth being (1) The eventBridge bus and (2) The asset files in S3

***Asynchrony of calls***
- Lambda functions should never need to wait synchronously on the outcome of another lambda
call

***Push-based messaging***
- Lambda functions should never need to actively poll to check whether a message exists in the
first place (the carrying costs during times of no activity would be prohibitive)

---

## mtw.coordination Messages

---

### Update Player

Notification that the characters or permissions associated with a player have been updated:
- player
- characters: Array of characters associated with this player

```ts
type UpdatePlayerCharacter = {
    address: AssetWorkspaceAddress;
    CharacterId: string;
}
```

---

### Update Asset
- assetId
- zone
- subFolder
- fileName: base fileName (before suffixes like '.wml' or '.json')

---

### Cache Asset
- zone
- player (only if zone === 'Personal')
- subFolder
- fileName: base fileName (before suffixes like '.wml' or '.json')

---

### Decache Asset
- assetId

---

## mtw.diagnostics Messages

---

### Heal Asset
- assetId
- zone
- subFolder
- fileName: base fileName (before suffixes like '.wml' or '.json')

---
---