# OGame in-game data formats (reference)

> **Status: unverified.** Everything below is derived from reading two third-party addon sources,
> not from a live game. Treat each item as a hypothesis to confirm with real captures on the PTS
> (saved HTML of the messages page, `getMessagesList` / `sendFleet` / `miniFleet` responses).
> Items marked **(inferred)** are deductions from how an addon uses a value, not something the
> addon states explicitly. Items marked **(gap)** are not covered by either source.

## Sources and citation keys

| Key | Source | License | Notes |
|---|---|---|---|
| `OGL l.N` | OGLight userscript v5.5.0, `greasyfork.user.js`, line N | MIT | Targets game v13 DOM, keeps v12 fallbacks (`gameVersion < 13`) |
| `TRK <file>` | OGame Tracker extension, `src/<file>` | All Rights Reserved | Only facts about the game are reported here, no code reproduced |

Tracker file abbreviations used below:

- `msg/base` = `content-scripts/message-tracking/base-message-tracking.ts`
- `msg/main` = `content-scripts/message-tracking/main.ts`
- `msg/expedition` = `content-scripts/message-tracking/expedition-tracking.ts`
- `msg/lifeform` = `content-scripts/message-tracking/lifeform-discovery-tracking.ts`
- `msg/combat` = `content-scripts/message-tracking/combat-report-tracking.ts`
- `msg/debris` = `content-scripts/message-tracking/debris-field-report-tracking.ts`
- `raw/*` = `shared/models/ogame/messages/*.ts` (raw enums)
- `meta` = `shared/ogame-web/getOgameMeta.ts`
- `ingame` = `content-scripts/empire-tracking/trackOnIngamePages.ts`

---

## 1. Messages page

### 1.1 URL and containers

| Fact | Source |
|---|---|
| Page URL: `index.php?page=ingame&component=messages` | TRK `msg/main` |
| Page component container: `#messagescomponent` (v13) or `#messagecontainercomponent` (v12) | OGL l.8496, l.9390 |
| Content container: `#pageContent .content` (observed for DOM mutations) | TRK `msg/base` |
| Message list holder: `.messagesHolder` (re-created on tab change; Tracker re-attaches its observer when it disappears) | TRK `msg/base` |
| Raw HTML of the currently loaded list: `ogame.messages.content`, an **array of HTML strings** (OGLight joins it and parses it with `DOMParser`) | OGL l.8557 |
| Pagination helpers exist on `ogame.messages`: `paginatorPrevious/Next/First/Last` (only in commented-out code) | OGL l.8435–8438 |

### 1.2 Tabs (categories / subtabs)

| Selector / id | Meaning | Source |
|---|---|---|
| `.singleTab.marker[data-category-id="2"]` | Active top-level category is **Fleets** (Tracker only tracks when this is active, to skip shared messages) | TRK `msg/base` |
| `.innerTabItem.active[data-subtab-id]` | Active fleet subtab; id read from `data-subtab-id` | OGL l.8495 |
| subtab `20` | Espionage reports | OGL l.8594 (comment "spies"), l.1001 |
| subtab `21` | Combat reports (contains types 25 and 48) | OGL l.8598–8601 |
| subtab `22` | Expeditions **and** lifeform discoveries (types 41, 61) | OGL l.8603 |
| subtab `23` | "cargo" — **(inferred)** Transport / unions tab: parsed with the same "other" reader, never added to stats | OGL l.8607, l.8809 |
| subtab `24` | "debris" — **(inferred)** "Other" tab: harvest reports (32) and wreckfield (54); added to stats | OGL l.8607–8610, l.8809 |
| subtab `25` | Parsed like espionage reports — meaning **(gap)** | OGL l.8594 |

### 1.3 Ajax requests on the messages page

| Request | Params (POST body) | Response facts | Source |
|---|---|---|---|
| URL contains `action=getMessagesList` | `activeSubTab=<subtab id>`, `showTrash=true\|false` (other params not visible) | Fires on tab change and pagination; list is then in `ogame.messages.content` | OGL l.803–805, l.991–1006 |
| `action=flagArchived` | `messageId` | JSON `isArchived` (1 = archived) | OGL l.818–826 |
| `action=flagDeleted` | `messageIds[]` (repeated) | — | OGL l.828–829 |
| `action=flagDeleteAll` | `activeSubTab`, `showTrash` | — | OGL l.831–834 |
| `component=messagedetails&messageId=<id>` | — | Opens a `.ui-dialog` containing `.detail_msg[data-msg-id]` | OGL l.938, l.9689–9694 |

### 1.4 Message element structure

| Selector / attribute | Meaning | Source |
|---|---|---|
| `div.msg[data-msg-id]` | One message; `data-msg-id` is a numeric id (parsed as int) | TRK `msg/base`, OGL l.8558–8563 |
| `.msg .rawMessageData` | Hidden child carrying all `data-raw-*` attributes | TRK `msg/base`, OGL l.8559 |
| `.msgContent` | Visible body | TRK `msg/main` utils, OGL l.9513 |
| `.msg_actions` | Action bar; for combat, a report link `.msg_actions a.txt_link` is present only for full reports | TRK `msg/combat`, OGL l.9512 |
| `message-footer-actions` | Custom element (footer buttons) | OGL l.8688, l.9697 |
| `.msgDate`, `.msgTitle` | Date and title | OGL l.8573, l.9561 |
| `.icon_apikey` | API key icon (OGLight sets `data-api-code` = hashcode on it) | OGL l.8574 |
| Detail dialog: `[data-combatreportid]` | Present for combat reports | OGL l.9695 |
| Detail dialog: `[data-message-type="10"]` | Present for espionage reports | OGL l.9696 |
| API codes in dialog match `cr-[a-z0-9-]*` (combat) and `sr-[a-z0-9-]*` (spy) | **(inferred)** same value as `data-raw-hashcode` | OGL l.9701, l.9716 |

---

## 2. Common raw attributes on `.rawMessageData`

| Attribute | Format | Notes | Source |
|---|---|---|---|
| `data-raw-messagetype` | int (string) | Message type, see table below. **Not present on every message** (Tracker notes espionage reports lack it) | TRK `msg/base`, OGL l.8564 |
| `data-raw-timestamp` | int, **Unix seconds** | Both addons multiply by 1000. OGLight treats it as a true epoch ("client" time source) | TRK all `msg/*`, OGL l.8565 |
| `data-raw-datetime` | unknown | Fallback when `timestamp` is missing; OGLight runs `parseInt(...)*1000` on it, so format **(gap)** | OGL l.8565 |
| `data-raw-hashcode` | string | Report API key; OGLight skips combat parsing when it is empty | OGL l.8566, l.8830 |
| `data-raw-targetplayerid` | int (string) | Target player id; on espionage reports equals own id for counter-espionage messages; `99999` = position 16 | OGL l.8567, l.8639, l.8663 |
| `data-raw-coords` | `"g:s:p"` | Used by expedition (41), discovery (61), combat (25), one-round (48), and by OGLight for tabs 23/24 | TRK `msg/expedition`, OGL l.8786, l.8814, l.8832 |
| `data-raw-targetcoordinates` | `"g:s:p"` | Used by Tracker for harvest reports (32) | TRK `msg/debris` |
| `data-raw-sourceplanetcoordinates` | `"g:s:p"` | Wreckfield (54) and counter-espionage source | OGL l.8670, l.8776 |
| `data-raw-coordinates` | `"g:s:p"` | Espionage reports | OGL l.8644 |

Coordinate parsing: Tracker accepts `g:s:p` with optional surrounding brackets (`[1:2:3]`)
(TRK `shared/utils/parseCoordinates.ts`); OGLight splits on `:` directly (OGL l.8672) so
**(inferred)** raw attributes have no brackets.

### 2.1 Message type ids (`data-raw-messagetype`)

| Id | Meaning | Source |
|---|---|---|
| 25 | Combat report (full) | TRK `raw/OgameRawMessageType.ts`, OGL l.8600 |
| 32 | Debris field harvest report (recycling) | TRK `raw/OgameRawMessageType.ts`, OGL l.9546 |
| 33 | Resource transport — **enum value only, never parsed** | TRK `raw/OgameRawMessageType.ts` |
| 34 | Fleet arrival — **enum value only, never parsed** | TRK `raw/OgameRawMessageType.ts` |
| 35 | Excluded from combat parsing by OGLight; meaning **(gap)** | OGL l.8830 |
| 41 | Expedition result | TRK `raw/OgameRawMessageType.ts`, OGL l.9546 |
| 48 | One-round combat (no full report) | OGL l.8601 |
| 54 | Wreckfield / ships recovered | OGL l.8609 |
| 61 | Lifeform discovery result | TRK `raw/OgameRawMessageType.ts`, OGL l.8740 |
| 70 | Anomaly: fleet stationed at the anomaly, waiting for opponents (3.9) | Live 2026-11-12 |
| 75 | Anomaly: a merchant convoy fled without delivering (3.9) | Live 2026-11-12 |
| 76 | Anomaly: reward delivered to the player's planet (3.9) | Live 2026-11-12 |
| 77 | Anomaly: the anomaly collapses, fleets return (3.9) | Live 2026-11-12 |
| (none) | Espionage reports may have no type attribute; detail dialog uses `data-message-type="10"` | TRK `msg/base`, OGL l.8640–8696 |

---

## 3. Per message type

### 3.1 Expedition (41)

| Attribute | Format | Shape / values | Source |
|---|---|---|---|
| `coords` | `"g:s:p"` | position 16 | TRK `msg/expedition` |
| `expeditionresult` | string enum | see below; **required** for Tracker | TRK `raw/OgameRawExpeditionResultType.ts`, OGL l.8723, l.8747–8757 |
| `size` | int | `0` = large / "Extraordinary", `1` = medium / "Especial", `2` = small / "Normal" | TRK `raw/OgameRawExpeditionSize.ts`, OGL l.8731, l.9555 |
| `depletion` | int | `1` none, `2` low, `3` medium, `4` high | TRK `raw/OgameRawExpeditionDepletionLevel.ts`, OGL l.8730 |
| `resourcesgained` | JSON object | `{ "metal"?: n, "crystal"?: n, "deuterium"?: n, "darkMatter"?: n }` — dark matter finds are carried here, not in a separate attribute | TRK `msg/expedition`, OGL l.8724 |
| `technologiesgained` | JSON object | `{ "<shipId>": { "name": string, "amount": n } }` | TRK `msg/expedition`, OGL l.8760–8762 |
| `itemsgained` | JSON array | `[ { "id": <item hash string>, "amount": n, "name": string } ]` (Tracker takes `[0].id`, OGLight `[0].name`) | TRK `msg/expedition`, OGL l.9549–9551 |
| `navigation` | JSON object | `{ "returnTimeAbsoluteIncreaseHours": n, "returnTimeMultiplier": n }` | TRK `msg/expedition`, OGL l.8728 |
| `shipslost` | JSON object | `{ "<shipId>": amount }` | OGL l.8734–8736 |
| `lifeform` | int | lifeform id 1–4 (see 3.2) | OGL l.8722 |
| `lifeformgainedexperience` | int | XP gained | OGL l.8726 |
| `artifactsfound` | int | artifacts gained | OGL l.8725 |

`expeditionresult` values:

| Raw value | Meaning | Source |
|---|---|---|
| `ressources` (sic, double s) | Resources found | TRK, OGL l.8747 |
| `darkmatter` | Dark matter found | TRK, OGL l.8748 |
| `nothing` | Nothing | TRK, OGL l.8749 |
| `shipwrecks` | Ships found | TRK, OGL l.8750 |
| `trader` | Trader | TRK, OGL l.8751 |
| `items` | Item found | TRK, OGL l.8752 |
| `fleetLost` | Fleet lost (black hole) | TRK, OGL l.8753 |
| `navigation` | Delay or early return | TRK, OGL l.8754–8755 |
| `combatPirates` | Pirate fight | TRK, OGL l.8756 |
| `combatAliens` | Alien fight | TRK, OGL l.8757 |

Navigation disambiguation differs between sources (to verify):
- Tracker: `returnTimeMultiplier == 1` → delay, otherwise early (TRK `msg/expedition`).
- OGLight: multiplier `< 1` → early; multiplier `> 1` or `returnTimeAbsoluteIncreaseHours >= 0` → late (OGL l.8754–8755).

Size is required by Tracker for resources, dark matter, ships, navigation and combat results
(TRK `service-worker/expeditions/ExpeditionModule.ts`); OGLight ignores size for nothing / trader /
fleet lost (OGL l.8738, l.8767).

### 3.2 Lifeform discovery (61)

| Attribute | Format | Values | Source |
|---|---|---|---|
| `coords` | `"g:s:p"` | | TRK `msg/lifeform` |
| `discoverytype` | string enum, optional | `none`, `artifacts`, `lifeform-xp`, `ship-lost`, `lifeform-found` (Tracker defaults to `none` when absent) | TRK `raw/OgameRawLifeformDiscoveryType.ts`, `msg/lifeform` |
| `artifactssize` | string enum, optional | `normal` (small), `big` (medium), `huge` (large), `full` (artifact storage full) | TRK `raw/OgameRawArtifactFindSize.ts`, OGL l.8731 |
| `artifactsfound` | int, optional | | TRK `msg/lifeform`, OGL l.8725 |
| `lifeform` | int, optional | `1` humans, `2` rocktal, `3` mechas, `4` kaelesh | TRK `raw/OgameRawLifeformType.ts`, OGL l.8722 |
| `lifeformgainedexperience` | int, optional | | TRK `msg/lifeform`, OGL l.8726 |
| `lifeformalreadyowned` | `"1"` / other, optional | boolean | TRK `msg/lifeform` |
| `shipslost` | not applicable to 61 | Discoveries involve no fleet ships; not read (OGLight reads the field for both 41 and 61, but that was only an inference) | OGL l.8734 |

Verified on PTS 2026-11-12: `discoverytype` is present for `artifacts`, `lifeform-xp` and `ship-lost`
and **absent for a discovery with no result** (a message with only `messagetype`, `timestamp`,
`date` and `coords`, i.e. `none`). `lifeform-found` was not seen. A `lifeform-xp` message also
carries `lifeformdiscovered` (localized lifeform name, e.g. `Kaeleshs`) and `lifeformalreadyowned`
(`"1"`); an `artifacts` message carries `artifactsfound` and `artifactssize` (`normal`, counts
matching the in-game display); a `ship-lost` message carries no other attribute.

OGLight classifies 61 by `artifactsfound > 0` → artifact, else `lifeformgainedexperience > 0` →
lifeform XP, else nothing (OGL l.8742–8746).

### 3.3 Combat report (25)

Raw attributes (all JSON except `coords`):

| Attribute | Shape (fields actually read) | Source |
|---|---|---|
| `coords` | `"g:s:p"` | OGL l.8832 |
| `defenderspaceobject` | `{ "owner": { "id": playerId }?, "coordinates": { "galaxy", "system", "position" }, "type": "planet" \| "moon" \| "anomaly" }` | TRK `msg/combat`, OGL l.8833, l.8841; `"anomaly"` live 2026-11-12 (3.9) |
| `fleets` | array of `{ "fleetId", "side": "attacker" \| "defender", "player": { "id" }?, "combatTechnologies": [ { "technologyId", ... } ] }` | TRK `msg/combat`, OGL l.8834, l.8843–8862 |
| `combatrounds` | array of rounds; each `{ "fleets": [ { "fleetId", "technologies": [ { "technologyId", "destroyedTotal" } ] } ] }` | TRK `msg/combat`, OGL l.8835, l.8870–8877 |
| `result` | see below | TRK `msg/combat`, OGL l.8836 |

`result` JSON:

| Field | Shape | Source |
|---|---|---|
| `winner` | `"attacker"` \| `"defender"` \| `"none"` | TRK `shared/models/ogame/combats/OgameCombatReport.ts`, OGL l.8848–8849 |
| `loot.resources` | array of `{ "resource": "metal"\|"crystal"\|"deuterium", "amount": n }` | TRK `msg/combat`, OGL l.8852–8854 |
| `debris.resources` | array of `{ "resource", "total": n, "remaining": n }` (Tracker reads `total`, OGLight reads `remaining`) | TRK `msg/combat`, OGL l.8888–8891 |
| `repairedTechnologies` | array of `{ "technologyId", "amount" }` (defences/ships repaired for the planet owner) | OGL l.8880–8883 |

Verified on PTS 2026-11-12 (probes attacking an empty inactive moon):
- `combatrounds` can be `[]` (a fight with no round): no ship is lost.
- `loot.resources` also lists `food` (and `loot.percentage`); amounts of unknown resources are
  ignored when summing metal / crystal / deuterium.
- The game writes empty lists as `[]`: `debris.resources` (with `requiredShips`,
  `shipsUsedForRecycling`, `totalRequiredShips`) and `repairedTechnologies`; they are not omitted.
- Each `fleets[]` entry also has `spaceObject`, `combatResearchPercentage` (array of
  `{ "id", "percentage" }`) and, for a defender without ships, `fleetId` `-1` and
  `combatTechnologies` `[]`. `combatTechnologies[]` entries carry `amount`.
- `result` also has `totalValueOfUnitsLost`, `deathStarDestroyed`, `moonCreation`, `honor` and
  `tacticalRetreat`.

No `lootFactor` field exists in the raw data: it is a sign Tracker derives itself
(+1 attacker who won, −1 defending planet owner who lost, 0 otherwise; 0 for expedition fights)
(TRK `service-worker/combat-reports/CombatReportModule.ts`). OGLight derives the same signs
(OGL l.8851–8862).

How each source identifies sides and special cases:

| Question | Method | Source |
|---|---|---|
| Own fleets | `fleets[]` entries where `player.id == ogame-player-id` meta; collect their `fleetId` and `side` | TRK `msg/combat`, OGL l.8843–8847 |
| Own planet attacked | `defenderspaceobject.owner.id == own player id` | TRK `msg/combat`, OGL l.8841 |
| Own losses | last element of `combatrounds`, fleets whose `fleetId` is own, sum `technologies[].destroyedTotal` per `technologyId`; OGLight subtracts `repairedTechnologies` when own planet defended | TRK `msg/combat`, OGL l.8870–8883 |
| Expedition fight (position 16) | `defenderspaceobject.coordinates.position == 16` | TRK `msg/combat` |
| Probe-only fight | Tracker: every attacker fleet has only `technologyId == 210` in `combatTechnologies`. OGLight: one side has a single tech `210` and loot sum is 0 | TRK `msg/combat`, OGL l.8867–8868 |
| Report without full data | Tracker skips 25 messages that have no `.msg_actions a.txt_link` (IPM attacks, 1-round fights) | TRK `msg/combat` |

### 3.4 One-round combat (48)

| Attribute | Format | Source |
|---|---|---|
| `coords` | `"g:s:p"` | OGL l.8814 |
| `shipslost` | JSON `{ "<shipId>": amount }` | OGL l.8819 |

OGLight treats a 48 message as probe-only when `shipslost` contains only key `210`
(OGL l.8823). No loot is read (OGL l.8815).

### 3.5 Debris field harvest (32)

| Attribute | Format | Source |
|---|---|---|
| `targetcoordinates` | `"g:s:p"` (debris field) | TRK `msg/debris` |
| `coords` | `"g:s:p"` (OGLight reads this one instead) | OGL l.8786 |
| `recycledresources` | JSON `{ "metal": n, "crystal": n, "deuterium"?: n }` (deuterium may be absent) | TRK `msg/debris`, OGL l.8787 |

Verified on PTS 2026-11-12: the message also has `recycleramount`, `totalcapacity`,
`debrisresources` (JSON `{ "metal", "crystal", "deuterium" }`, all three keys) and
`recycledresources` with all three keys too; `coords` equals `targetcoordinates`.

### 3.6 Wreckfield (54)

| Attribute | Format | Source |
|---|---|---|
| `sourceplanetcoordinates` | `"g:s:p"` | OGL l.8776 |
| `technologiesrecovered` | JSON `{ "<shipId>": { "amount": n, ... } }` | OGL l.8777 |

### 3.7 Transport / fleet arrival / resources delivered

- Tracker declares type `33` = resource transport and `34` = fleet arrival but parses neither
  (TRK `raw/OgameRawMessageType.ts`; no other reference in the codebase).
- OGLight reads, for every non-54 message in subtabs 23 and 24, the attribute
  `data-raw-cargo` as JSON `{ "metal", "crystal", "deuterium", ... }` and labels it "cargo"
  when any value > 0 (OGL l.8788, l.8800–8805). **(inferred)** these are transport / arrival
  messages carrying the delivered resources.
- **(gap)** Neither source reads sender / receiver player ids or planet ids on these messages,
  nor confirms the numeric type of a "resources delivered by another player" message.
  `data-raw-targetplayerid` is read globally by OGLight (OGL l.8567) but only used for spy reports.
  Must be captured on the PTS.

### 3.8 Espionage report (bonus, subtab 20)

Attributes read by OGLight (OGL l.8638–8670): `targetplanetid`, `playername`,
`targetplanettype` (1 = planet, else moon), `coordinates`, `active`, `activity` (minutes, -1 = none),
`resources`, `metal`, `crystal`, `deuterium`, `hiddenships` (1/0), `hiddendef` (1/0),
`fleet` / `defense` / `research` (JSON `{ "<techId>": level_or_count }` or `"-"`),
`loot` (percent), `fleetvalue`, `defensevalue`, `attacking` (0/1),
and for counter-espionage: `sourceplayerid`, `sourceplayername`, `sourceplanetcoordinates`.

### 3.9 Anomaly messages (70, 75, 76, 77)

Seen on a live account (2026-11-12, 138 messages), all in subtab 24 (Misc), sender "control
tower". **None carries a resource attribute in `.rawMessageData`.**

| Type | Title (fr) | Raw attributes | Meaning |
|---|---|---|---|
| 70 | Stationnement de la flotte | `coords` (anomaly), `sourceplanet*`, `sourceplayer*`, `targetplanetid`, `targetplayerid` = `99999`; rarely `targetplanettype` = `4` and `targetplanetname` = anomaly kind (e.g. "Petite livraison de ressources") | A fleet reached the anomaly and waits for opponents |
| 75 | Convoi de marchandises en fuite | `coords` (anomaly), `sourceplanet*`, `sourceplayer*`, `targetplanetid` | A merchant convoy reached the anomaly, saw the stationed warships and fled without its cargo |
| 76 | Récompense d`anomalie livrée | `coords`, `targetplanet*`, `targetplayer*`: the player's **own planet** receiving the reward | Reward of an anomaly mission delivered |
| 77 | L`anomalie se résorbe | `coords` (anomaly), `targetplanetid` | The anomaly collapses; fleets return home |

**Rewards (76) are only in the message HTML**, not in the raw attributes:

- The anomaly coordinates are the first `a.txt_link` of `.msgContent` (`[g:s:p]`); `coords` is the
  receiving planet.
- `.content-box` holds a `group-title-label` ("Récompense reçue" or "Butin", 34 / 4 messages) and
  one or more `.loot-row > .loot-item`.
- Resources: `<resource-icon class="metal|crystal|deuterium ...">` with
  `aria-description="<localized name>: <integer>"`; `.amount` is the localized, dot-grouped value.
- Ships: `<technology-icon ... transportersmall="" ...>` (202), `fighterlight=""` (204): the ship
  is a valueless attribute named after the game's technical name; same `aria-description` format.
- Seen: 1 to 4 items per message, resources and ships mixed, no lithium.

**Anomaly missions also produce combat reports (25)** at the anomaly coordinates: the player is
the defender, the attacker is `{ "type": "npc", "id": 99999 }` with a localized name, and
`defenderspaceobject.type` is `"anomaly"` (language-independent discriminator; pirates and aliens
at position 16 have `"planet"`). Seen: 54 such reports, never any loot, own losses in 7, debris
fields at the anomaly position.

**(gap)** Lithium spent (scan, reward collection) and refunded is not in any message: it needs
captures of the anomaly page and its requests.

---

## 4. Ship ids and base cost

Names from Tracker `ShipType` enum (TRK `shared/models/ogame/ships/ShipType.ts`); costs from
OGLight `Datafinder` table (OGL l.144–160).

| Id | Name | Metal | Crystal | Deut | Cost line |
|---|---|---:|---:|---:|---|
| 202 | Small cargo | 2,000 | 2,000 | 0 | OGL l.144 |
| 203 | Large cargo | 6,000 | 6,000 | 0 | OGL l.145 |
| 204 | Light fighter | 3,000 | 1,000 | 0 | OGL l.146 |
| 205 | Heavy fighter | 6,000 | 4,000 | 0 | OGL l.147 |
| 206 | Cruiser | 20,000 | 7,000 | 2,000 | OGL l.148 |
| 207 | Battleship | 45,000 | 15,000 | 0 | OGL l.149 |
| 208 | Colony ship | 10,000 | 20,000 | 10,000 | OGL l.150 |
| 209 | Recycler | 10,000 | 6,000 | 2,000 | OGL l.151 |
| 210 | Espionage probe | 0 (absent in OGL, 0 in TRK `ships/EspionageProbe.ts`) | 1,000 | 0 | OGL l.152 |
| 211 | Bomber | 50,000 | 25,000 | 15,000 | OGL l.153 |
| 212 | Solar satellite | 0 | 2,000 | 500 | OGL l.154 |
| 213 | Destroyer | 60,000 | 50,000 | 15,000 | OGL l.155 |
| 214 | Deathstar | 5,000,000 | 4,000,000 | 1,000,000 | OGL l.156 |
| 215 | Battlecruiser | 30,000 | 40,000 | 15,000 | OGL l.157 |
| 217 | Crawler | 2,000 | 2,000 | 1,000 | OGL l.158 |
| 218 | Reaper | 85,000 | 55,000 | 20,000 | OGL l.159 |
| 219 | Pathfinder | 8,000 | 15,000 | 8,000 | OGL l.160 |

- No id 216 in either source.
- OGLight's list of flyable ships: 202–211, 213–215, 218, 219 (OGL l.448); cargo-capable:
  202, 203, 209, 210 (if server `probeCargo`), 219 (OGL l.449, l.501).
- Defences 401–408 and missiles 502/503 costs are at OGL l.163–174.

---

## 5. Account identity, page meta tags, time

### 5.1 `<meta name="ogame-...">` tags

| Meta name | Content format | Read by |
|---|---|---|
| `ogame-universe` | host, e.g. `s<serverId>-<lang>.ogame.gameforge.com` (Tracker splits on `.` then `-`, strips `s`) | TRK `meta` |
| `ogame-universe-name` | universe display name | OGL l.456 |
| `ogame-universe-speed` | int, economy speed | OGL l.458 |
| `ogame-universe-speed-fleet-peaceful` / `-holding` / `-war` | int, fleet speeds | OGL l.459–461 |
| `ogame-language` | server language code | TRK `meta`, OGL l.457 |
| `ogame-version` | dotted version; major `< 13` means legacy DOM | OGL l.249, l.462 |
| `ogame-player-id` | int | TRK `meta`, OGL l.467 |
| `ogame-player-name` | string | OGL l.469 |
| `ogame-planet-id` | int, current planet/moon id | TRK `empire-tracking/trackOverviewPage.ts`, OGL l.472 |
| `ogame-planet-type` | `planet` \| `moon` | TRK `trackOverviewPage.ts`, OGL l.451 |
| `ogame-timestamp` | int, Unix **seconds** (server "now") | TRK `trackOverviewPage.ts`, `trackEmpirePage.ts` |

No timezone-related meta tag is read by either source **(gap)**.

Other identity signals: cookie `oglocale` = user UI language (`"undefined"` string possible in
vacation mode) (TRK `meta`, OGL l.471); server id also derivable from `location.host` digits
(OGL l.455); character class from `#characterclass .sprite` classes `miner` / `warrior`
(else explorer) (OGL l.468).

### 5.2 Server time and timezone

| Mechanism | Facts | Source |
|---|---|---|
| Page global `serverTime` | A JS `Date` provided by the game page | OGL l.2350–2356 |
| Page globals `localTimeZoneOffsetInMinutes`, `serverTimeZoneOffsetInMinutes` | Numbers (may be 0); OGLight caches them | OGL l.478–479 |
| OGLight `clientOffset` | `round((serverTime.getTime() - Date.now()) / 1h) * 1h` — whole-hour shift between game clock and browser clock | OGL l.2352, l.2476 |
| OGLight time conversion | `server = client + clientOffset`; raw message timestamps are passed as *client* time, i.e. **(inferred)** they are true UTC epochs while `serverTime` is shifted to server wall-clock | OGL l.2479–2484, l.8565 |
| Public API `serverData.xml` | `https://s<id>-<lang>.ogame.gameforge.com/api/serverData.xml`; `<serverData>` has attributes `timestamp`, `serverId` and children incl. `timezone` (string) and `timezoneOffset` (string), plus `speed`, `speedFleetPeaceful/War/Holding`, `galaxies`, `systems`, `donutGalaxy`, `donutSystem`, `debrisFactor`, `globalDeuteriumSaveFactor`, `probeCargo`, class bonuses, `lifeformSettings`… | TRK `service-worker/server-settings/ServerSettingsModule.ts` |
| Public API `highscore.xml?category=1&type=0` | `highscore.player[]` with `id`, `position`, `score` | TRK `ServerSettingsModule.ts` |

Tracker stores `timezone` / `timezoneOffset` but uses them nowhere else (only schema / export),
so their exact format (e.g. IANA name vs `+01:00`) is **(gap)**.

---

## 6. Fleet dispatch

### 6.1 `fleetDispatcher` page object (`page=ingame&component=fleetdispatch`)

Fields (OGL usages):

| Field | Type / shape | Source |
|---|---|---|
| `currentPage` | `"fleet1"` \| `"fleet2"` | OGL l.5385, l.5393 |
| `shipsOnPlanet` | array of `{ id, number }` | OGL l.4940–4942, l.6113 |
| `shipsToSend` | array of `{ id, number }` | OGL l.4863, l.6054 |
| `targetPlanet` | `{ galaxy, system, position, type, name }`; type `1` planet, `2` debris field, `3` moon | OGL l.5254–5258, l.5279, l.5602 |
| `currentPlanet` | `{ galaxy, system, position, ... }` | OGL l.6227 |
| `mission` | int (see section 7) | OGL l.5433 |
| `speedPercent` | int, 1–10 scale (default 10) | OGL l.5434, l.5591 |
| `cargoMetal`, `cargoCrystal`, `cargoDeuterium`, `cargoFood` | ints | OGL l.5897–5900 |
| `metalOnPlanet`, `crystalOnPlanet`, `deuteriumOnPlanet`, `foodOnPlanet` | ints | OGL l.6434–6437, l.5372 |
| `expeditionTime`, `holdingTime` | hours | OGL l.2390–2391 |
| `expeditionCount`, `maxExpeditionCount` | ints | OGL l.5597 |
| `union`, `unions` | ACS id; `unions` values `{ id, time (s) }` | OGL l.5437, l.5475 |
| `retreatAfterDefenderRetreat`, `lootFoodOnAttack` | booleans | OGL l.5435–5436 |
| `sendFleetUrl`, `checkTargetUrl` | URLs for the two POSTs | OGL l.5443, l.5211 |
| `fleetHelper.shipsData` | `{ "<shipId>": { name, cargoCapacity, baseCargoCapacity, fuelConsumption, speed, ... } }` | OGL l.5213, l.5567–5581 |

Methods: `getConsumption()` (deuterium; **may return a decimal**, OGLight truncates),
`getDuration()` (seconds, one way), `getCargoCapacity()`, `getFreeCargoSpace()`,
`getHoldingTime()`, `getDeuteriumOnPlanetWithoutConsumption()`, `hasEnoughFuel()`,
`selectShip(id, n)`, `findShip(id)`, `selectMission(n)`, `refresh()`, `updateToken(t)`,
`appendTokenParams/ShipParams/TargetParams/CargoParams/PrioParams(params)`,
`displayErrors(errors)`, `setTargetPlanet(...)`, `setOrders(...)`
(OGL l.5372, l.5904, l.2388, l.5339, l.5380, l.5422–5440, l.6370).

### 6.2 `checkTarget` request

POST to `fleetDispatcher.checkTargetUrl` (URL contains `action=checkTarget`) with token, ship,
target params and `union`. JSON response fields read: `shipsData`, `newAjaxToken`, `orders`,
`targetInhabited`, `targetPlayerId`, `targetPlayerName`, `targetIsStrong`, `targetIsOutlaw`,
`targetIsBuddyOrAllyMember`, `targetPlayerColorClass`, `targetPlayerRankIcon`,
`playerIsOutlaw`, `targetPlanet { galaxy, system, position, type, name }`
(OGL l.5204–5214, l.5236–5258).

### 6.3 `sendFleet` request (OGLight `submitFleet2` replacement)

POST to `fleetDispatcher.sendFleetUrl` (OGL l.5403–5466). Body:

| Param | Value | Source |
|---|---|---|
| token / ship / target / cargo / priority params | `token`, `am<shipId>=<count>` per ship, `galaxy`, `system`, `position`, `type`, `metal`, `crystal`, `deuterium`, `food`, `prioMetal`, `prioCrystal`, `prioDeuterium`, `prioFood` | PTS 2026-11-12 |
| `mission` | int | OGL l.5433 |
| `speed` | `speedPercent` | OGL l.5434 |
| `retreatAfterDefenderRetreat` | 0/1 | OGL l.5435 |
| `lootFoodOnAttack` | 0/1 | OGL l.5436 |
| `union` | ACS id | OGL l.5437 |
| `holdingtime` | hours | OGL l.5440 |
| `force` | `true`, only when re-sent after the bash-limit confirmation | OGL l.5439 |

Response: a JSON **string** (parsed with `JSON.parse`) with:

| Field | Meaning | Source |
|---|---|---|
| `success` | `true` on success | OGL l.5446 |
| `message` | success text (shown in fade box) | OGL l.5447 |
| `redirectUrl` | URL to go to after sending | OGL l.5449 |
| `errors` | array passed to `displayErrors` (elsewhere: `errors[0].message`) | OGL l.5458, l.10783 |
| `newAjaxToken` | new CSRF token, on failure | OGL l.5455, l.5460 |
| `responseArray.limitReached`, `responseArray.force` | bash-limit warning flow | OGL l.5454 |

**No fleet id in the response** (verified on PTS 2026-11-12: only `redirectUrl`, `message`,
`success`, `status`, `newAjaxToken`, `components`, `acsValues`). After success OGLight only records what it sent
(`shipsToSend`, `targetPlanet`, `mission`, cargo, `getConsumption()`) (OGL l.5887–5906).
To link a dispatch to a fleet, the fleet must be found afterwards in the event list / movement
page (see 6.5).

### 6.4 Galaxy `miniFleet` request

URL: page global `miniFleetLink` (contains `action=miniFleet`), POST, `dataType: json`
(OGL l.6459–6464). Params observed: `mission`, `galaxy`, `system`, `position`, `type`
(1 planet, 2 debris, 3 moon), `shipCount`, `token` (page global), optional `popup`; OGLight adds
its own `uid`, `retry`, `additionalParams` (OGL l.876–886, l.1012–1018, l.6450–6456).

Response JSON (OGL l.871–918):

| Field | Meaning |
|---|---|
| `newAjaxToken` | new token |
| `response.success` | boolean |
| `response.message` | text |
| `response.shipsSent` | ships sent count |
| `response.slots` | used fleet slots |
| `response.probes`, `response.recyclers`, `response.missiles` | remaining counts on planet |
| `error.message` / `response.message` | error text on failure |

**No consumption and no fleet id** (verified on PTS 2026-11-12). The full response is
`{ components, acsValues, response: { message, type, slots, probes, recyclers, explorers,
missiles, shipsSent, coordinates { galaxy, system, position }, planetType, success }, status,
success, message, newAjaxToken }`. `fleetDispatcher` does not exist on the galaxy page, so the
consumption of a galaxy dispatch is unknown.
OGLight skips its handling for `mission=15` (OGL l.869).

Related: `action=sendDiscoveryFleet` / `action=sendSystemDiscoveryFleet` respond with
`response.success` and `response.coordinates { galaxy, system }` or
`response.sentToCoordinates[]` (OGL l.941–953).

### 6.5 Fleet movements (event list / movement page)

| Fact | Source |
|---|---|
| Event list: rows `#eventContent tbody tr` / `.eventFleet` with id `eventRow-<fleetEventId>` | OGL l.10245–10247, TRK `ingame` |
| Row attributes: `data-mission-type` (int), `data-return-flight` (`"true"`/`"false"`), `data-arrival-time` (Unix seconds) | OGL l.10247–10249, TRK `ingame` |
| `.coordsOrigin`, `.destCoords` (text `[g:s:p]`); `.originFleet` / `.destFleet` contain `figure.planet` / `figure.moon` / `figure.tf` (debris) | OGL l.10255–10261, TRK `ingame` |
| Ships and cargo only in tooltip HTML of `.icon_movement .tooltip` / `.icon_movement_reserve .tooltip` (`title` or `data-tooltip-title`), table `.fleetinfo tr` with `td` label and `.value` | OGL l.10243, l.10309–10316, TRK `ingame` |
| OGLight assumes the return event of outbound event `N` has id `N+1` **(inferred)** | OGL l.10251 |
| v13: `component=eventList` ajax returns JSON with HTML in `content.eventlist` | OGL l.856 |
| Movement page: `#movementcomponent .fleetDetails` with `id="fleet<fleetId>"`; recall link `.reversal a` / `.reversal_time a` | OGL l.10134–10140, l.2523 |
| Fleet dispatch page ship counts: `#technologies [data-technology="<shipId>"] .amount[data-value]` | TRK `empire-tracking/trackFleetDispatchPage.ts` |

---

## 7. Mission type ids

| Id | Mission | Source |
|---|---|---|
| 1 | Attack | TRK `shared/models/ogame/fleets/FleetMissionType.ts`, OGL l.3753 |
| 2 | ACS attack (selected when `union` is set) | TRK, OGL l.5472 |
| 3 | Transport | TRK, OGL l.5589 |
| 4 | Deployment | TRK |
| 5 | ACS defend (uses `holdingTime`) | TRK, OGL l.2391 |
| 6 | Espionage | TRK, OGL l.907 |
| 7 | Colonization | TRK |
| 8 | Recycle debris field (target type 2) | TRK, OGL l.5279, l.5601 |
| 9 | Destroy moon | TRK, OGL l.10302 |
| 10 | Missile attack (Tracker ignores these rows) | TRK, TRK `ingame` |
| 15 | Expedition (uses `expeditionTime`) | TRK, OGL l.2390 |
| 16 | Trade | TRK |
| 17 | "docks" (OGLight comment) — meaning to confirm | OGL l.10172 |
| 18 | Lifeform discovery ("Search for lifeforms") | TRK, OGL l.10172 |

Planet/target type ids: `1` planet, `2` debris field, `3` moon
(TRK `shared/models/ogame/common/PlanetType.ts`, OGL l.907, l.5279).

### 6.6 Verified on PTS (2026-11-12)

- `checkTarget`, `sendFleet` and `miniFleet` go through jQuery ajax: the global `ajaxSend` and
  `ajaxSuccess` events fire for all three, with OGLight enabled and with OGLight disabled.
- In `ajaxSend` of `sendFleet`, `fleetDispatcher.getConsumption()` is readable and matched the
  deuterium actually spent (706,760 displayed and deducted from the planet). `currentPage` is
  `fleet2`, `mission` and `speedPercent` are set.
- During `checkTarget`, `getConsumption()` returns `NaN` and `mission` is `0`: the consumption is
  only meaningful in the `sendFleet` `ajaxSend`, and a non-finite value must be treated as unknown.
- Recall: `POST page=ingame&component=movement&action=recallFleet&fleetId=<id>&asJson=1`, response
  `{ components, status, success, message, newAjaxToken }`. **A recall refunds no deuterium**: the
  origin's deuterium was the same after departure, after the recall and after the return.

---

## 8. Main gaps to capture on the PTS

1. **Transport / resources delivered**: numeric type of the message, presence of sender and
   receiver player ids and planet ids, exact keys of `data-raw-cargo`. Types 33/34 are only named.
2. ~~Fleet id in `sendFleet` response~~: absent (6.3). Only the movement page exposes it (6.5).
3. ~~`miniFleet` consumption~~: absent (6.4); galaxy dispatches have an unknown consumption.
4. **Timezone**: no meta tag; only `serverData.xml` `timezone` / `timezoneOffset` (format unknown)
   and page globals `serverTimeZoneOffsetInMinutes` / `localTimeZoneOffsetInMinutes`.
5. `data-raw-datetime` format, subtab 25 meaning, type 35 meaning.
6. **Anomaly page**: the requests are known from the game script (9.2), but not their responses,
   nor the collect overlay DOM, nor the shape of `lithiumBonus`.

---

## 9. Anomaly page (`component=orion`)

Source: four PTS page dumps (2026-11-12, game 13.1.0) and the game bundle loaded by the page
(`gf1.geo.gfsrv.net/cdn04/4374488b582302d1e7644cff669d2c.js`, classes `Scanner` and the orion
missions module). Facts read from the script are marked **(script)**: confirmed in code, not yet
observed on the network.

### 9.1 Page and tabs

- `page=ingame&component=orion`, `var currentPage = "orion"`, container `#orioncomponent`.
- Tabs loaded by ajax (`fetchMissions`, `fetchScanner`, `fetchLithiumProduction`,
  `fetchControlCenter`): mission overview, lithium production, scanner, control center.
- Page globals: `orionActionUrl` (`...component=orion&asJson=1`), `orionAjaxUrl`,
  `lithiumProduction` (per hour), `lithiumStorageCapacity`, `token`.
- Lithium balance (account-wide, all planets): `.orionLithiumBar .orionLithiumAmount[data-value]`
  and, on the scanner tab, `#lithiumAmount[data-value]` (float). The game itself refreshes it
  (3 s display tick, `fetchCurrentLithium` sync): the balance moves without any player action.

### 9.2 Actions (all `POST orionActionUrl + '&action=<name>'`, with `token`) (script)

| Action | Trigger | Data | Response fields used by the game |
|---|---|---|---|
| `fetchScanCost` | anomaly level or range changed | `anomalyQuantity`, `scannerRange` | `scanCost`, `currentLithium`, `lithiumPerHour` |
| `performScan` | "Scan" button | `anomalyQuantity` (level), `range`, `force` (0/1) | `status`, `message`, `returnAjaxList` (HTML of the result cards), `errors[0].error` (400002 = not enough free positions, `freeInRange`) |
| `activateMission` | "Rechercher" on a result card | `anomalyMissionId` | `status`, `message`, `missionsWithoutFleet` |
| `collectRewards` | "Collect" button or overlay | `spaceObjectId`, optional `darkMatterPrice` | `status`, `message`, `canCollectReward`, `lithiumBonus` `{ title, message }` (optional) |
| `increaseMaxScanResults`, `increaseAnomalyDiscoveryCapacity` | slot purchase | none | `status`, `slotPurchase`, `maxScanResults`, `anomalyDiscoveryCapacity` |
| `renameMission` | mission rename | | |

- **The scan response carries no cost.** The game subtracts `$('#scanCostValue').data('value')`,
  set by `fetchScanCost`; in the dumps `#scanCostValue` only has `data-tooltip-title` (localized,
  dot-grouped), so the cost must be read from the DOM at the moment of the request.
- **Collecting can be paid in lithium or in Dark Matter**: the Dark Matter overlay
  (`.orionCollectRewardsDarkMatter[data-dark-matter-price]`) adds `darkMatterPrice` to the request.
- Collecting launches a reward-delivery fleet; the reward arrives later as message 76 (3.9).
- The collect overlay is loaded from `page=componentOnly&component=orion&action=fetchCollectRewardsOverlay&ajax=1&spaceObjectId=<id>`
  (9.4); with the "don't show again" preference, `.directCollect` posts without any overlay.
- `lithiumBonus` is the only refund-like field found; its amount format is unknown.
- No request for deleting a mission was found in the script.

### 9.3 DOM read on the page

- Scanner result card `.scannerResultCard`: name `.scannerResultName`, PvP/PvE
  `.scannerResultTypeIcon.pvp|.pve`, row cells (level, target link `[g:s:p]`, duration, waves,
  distance, type `delivery`/combat, reward cost in lithium as text + `data-tooltip-title`),
  estimated rewards `.rewardLine` (`≈` values). No cost shown on the "Rechercher" button.
- Active mission `.anomalyMission`: reward cost `.rewardCostsValue[data-tooltip-title]`,
  direct collect `.directCollect[data-space-object-id]`, waves with the NPC fleets.
- Seen anomaly kinds (fr): "Livraison précieuse", "Livraison : cristal", "Rencontre mineure /
  intermédiaire d`extraterrestres"; PvP missions give double rewards and can be attacked by
  other players.

### 9.4 Collect overlay (`.orionCollectRewards`)

Seen on a live account (2026-11-12), lithium version only:

- Root `div.orionCollectRewards[data-space-object-id][data-collect-rewards-url]`; buttons
  `.orionCollectConfirm` ("Accepter") and `.orionCollectCancel`.
- **Rewards are collected wave by wave**: `.collectWaveList > .collectWaveRow.affordable`, each with
  `.cwWave`, `.cwRewards .rewardLine` (resource icon class + `.rewardAmount`, exact values, no `≈`)
  and `.cwCost` ("Cout en lithium : n", localized text). A mission can therefore be collected
  several times, each collect giving its own message 76.
- `.collectSummaryRewards .rewardLine`: the sum of the listed waves; `.collectDeliveryTarget`: the
  receiving planet.
- `.collectTotalValue`: total lithium cost of the listed waves (dot-grouped), `.have`: lithium owned.
- The overlay lists only the waves already fought and not yet collected: in the capture the
  mission was still running (wave 3 of 3 to come), so 2 waves were listed. Collecting again later
  pays for the remaining waves.
- **The mission's `.rewardCostsValue` is the cost of all its waves**, not of one collect (3 × the
  wave cost in the capture).
- **(gap)** Rows without `affordable` and the Dark Matter overlay (`.orionCollectRewardsDarkMatter`,
  served by the game, not built in the script) were not seen; the Dark Matter one probably
  appears when the lithium is insufficient **(inferred)**.

