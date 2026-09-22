# OGame Clone

A locally hosted, OGame-style space strategy game in which each player develops a single planet through buildings, research and shipyard production. OGame's rules apply, with the names changed to those in the design.

## Language

### Players and places

**Player**:
A registered account, identified by a username and password, that owns exactly one Planet. Players do not interact with each other.
_Avoid_: User, account, commander

**Universe**:
The single game world hosted by one server instance. All Players live in it, and it sets the Universe Speed.
_Avoid_: Server, world, galaxy

**Universe Speed**:
A configured multiplier that scales production and construction speed across the whole Universe, as on OGame's x1/x5/x8 servers.
_Avoid_: Game speed, tick rate

**Planet**:
A Player's home world. It holds Resources, Building levels, ships and queues, and has Coordinates, a name, Fields and a temperature range.
_Avoid_: Colony, base

**Coordinates**:
A Planet's address in the form `[galaxy:system:position]`, e.g. `[4:212:8]`. It is drawn at random at registration, is unique to one Planet, and never changes. The position (1–15) sets the Planet's temperature range and any production bonus.
_Avoid_: Location; "position" for the whole address (it means only the third number)

### Resources

**Alloy**:
The basic construction Resource, equivalent to OGame's Metal.
_Avoid_: Metal

**Crystal**:
The secondary construction Resource.

**Deuterium**:
The fuel and advanced construction Resource.

**Energy**:
A Planet's power balance: capacity minus consumption. It is never stockpiled, and a shortfall reduces mine production.

**Storage Capacity**:
The most of one Resource a Planet can hold, set by that Resource's storage Structure. A mine stops producing once its Resource reaches capacity. Energy has no Storage Capacity.
_Avoid_: Cap, limit, warehouse size

**Production Factor**:
The share of full output a Planet's mines run at. It is 100% while Energy capacity covers consumption, and falls in proportion when it doesn't. When Deuterium runs out, the Fusion Reactor also throttles down to what incoming Deuterium can fuel.
_Avoid_: Efficiency, production rate

### Development

**Structure**:
Something a Player builds on the Planet, such as the Alloy Extractor or the Research Lab. It has a level that goes up one step per upgrade.
_Avoid_: Building, facility

**Technology**:
A Player-wide advance, such as Warp Drive or Computation. It has a level and unlocks or improves other things.
_Avoid_: Research (as the noun for the item), tech

**Research**:
The act of raising a Technology by one level. It happens in the Research Lab and takes time.

**Research Queue**:
The Player's list of pending Research, at most five entries. Only one runs at a time, and the rest wait in order. Each entry is paid for when it joins the queue.

**Build Slot**:
One of the Planet's two places where a Structure upgrade runs. An upgrade starts the moment it takes a free slot; there is no waiting list behind the slots.
_Avoid_: Build queue, construction queue

**Shipyard Order**:
A request to build a number of one ship type, paid in full when placed. Orders run one after another, each finishing unit by unit, and cannot be cancelled.
_Avoid_: Batch, production job

**Cancel**:
Withdrawing a Structure upgrade or Research before it finishes, with everything paid for it given back.
_Avoid_: Abort, demolish
