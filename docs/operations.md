# 🛠️ Running it

The map, backups, updates, and what to do when something misbehaves.
The everyday commands are in the [main README](../README.md).


---

## 🗺️ The map

BlueMap renders the world into a browsable 3D map at `https://$MAP_HOST`, and
the admin panel embeds it under **Map**.

Two things make it work, both already set:

- **`accept-download: true`** in [`server/bluemap/core.conf`](../server/bluemap/core.conf).
  BlueMap needs Mojang's client jar for block models and textures and refuses to
  fetch it without consent. The default is `false`, and a server that misses this
  looks like BlueMap silently doing nothing.
- **`render-thread-count: 2`.** Rendering competes with the server tick. Two
  threads on a 6-core host leaves the game responsive; raising it makes the first
  render faster and the server choppier.

The first full render of an existing world takes a while. Watch it with
`make map`.

### 🌙 The render window

Rendering and playing compete for the same CPU, so the maps do not render while
people are online. They stay **frozen through the day** and catch up in one
window overnight:

| | |
|---|---|
| 🌙 `04:00` | `make map-render` — unfreeze all three dimensions, then `bluemap update` |
| ⏸️ `08:00` | `make map-pause` — freeze them again until the next window |

Both are host crontab entries installed by Ansible
([`roles/minecraft/tasks/cron.yml`](../ansible/roles/minecraft/tasks/cron.yml)),
in the host timezone. Move the window by editing
`minecraft_map_render_cron` / `minecraft_map_pause_cron` in
[`roles/minecraft/defaults/main.yml`](../ansible/roles/minecraft/defaults/main.yml)
and re-running `make provision`. Either target can be run by hand at any time —
that is the whole mechanism, there is no separate state.

Output goes to `/var/log/minecraft-cron.log` on the host, rotated weekly.

> BlueMap's output lives under `server/data/` and can reach gigabytes. It is
> excluded from backups on purpose — it is fully regenerable from the world, and
> including it would multiply every archive.

### 🌍 Pre-generating

Worldgen is the most expensive thing the server does, and doing it while someone
is flying through fresh chunks is what players feel as lag. Chunky can generate
it in advance:

```bash
make pregen R=3000     # radius in BLOCKS around spawn, not chunks
make cmd C="chunky progress"
make cmd C="chunky cancel" && make cmd C="chunky confirm"   # cancel needs both
```

Budget the disk before starting: this pack's overworld measures about **15 KB
per generated chunk**, so `R=3000` costs roughly 2 GB and `R=10000` roughly
22 GB — before backups, which keep three more copies of whatever that becomes.

`continueOnRestart` is on in [`server/chunky/config.json`](../server/chunky/config.json),
so a deploy or restart resumes the run instead of losing it.

---

## 📦 Backups

The `backups` sidecar runs `save-off` → archive → `save-on` over RCON, so
snapshots are consistent. It runs **at 00:00 in the container's timezone**
(`TZ`, Europe/Kyiv) and keeps **3 days**.

Two deliberate choices sit behind that:

- **A clock, not an interval.** `CRON_SCHEDULE` pins the run to local midnight.
  `BACKUP_INTERVAL` would instead mean "24h after whenever the container last
  started", which drifts into the evening after every deploy.
- **Three days, not seven.** A mature modded world runs to several GB, so a
  6-hourly / 7-day schedule would keep 28 archives and could fill a 100 GB disk
  on its own. Three daily archives cover the realistic case — "yesterday's world
  was fine" — at a tenth of the cost.

`PAUSE_IF_NO_PLAYERS` is off for the same reason: at midnight nobody is online,
and pausing would skip every scheduled run.

```bash
make backup        # run one immediately
make backups       # list archives
```

Tune `BACKUP_CRON` and `PRUNE_BACKUPS_DAYS` in `.env`, then `make up` — not
`make restart`, which only recreates the Minecraft container.

### Restoring

```bash
make backups                                          # find the archive
make restore F=server/backups/world-20260809-030000.tar.gz
```

It asks for confirmation, stops the server, moves the current world aside as
`server/data/world.before-restore-<timestamp>` rather than deleting it, unpacks the
archive and starts back up.

> Backups sit on the same disk as the server. That covers a corrupted world or a
> bad mod update — it does **not** cover losing the VPS. Copy `server/backups/`
> off-host on a schedule, e.g. `rclone sync server/backups/ remote:mc-backups` from cron.

---

## ⬆️ Updating

```bash
make update        # pull newer images, recreate the container
```

This picks up base-image fixes and re-resolves `server/mods.txt`. With
`NEOFORGE_VERSION` empty it may also move you onto a newer NeoForge build —
which is exactly why you should pin it once the server is stable.

**Take a backup before any update that touches mods or the MC version.** Mod
updates can and do change world data irreversibly.

---

## 🩺 Troubleshooting

**The server keeps restarting.** `make logs`, find the first `ERROR`. On a
modded server it is almost always a mod: wrong loader, wrong MC version, or a
missing dependency. `server/data/crash-reports/` has the details.

**`make status` shows `unhealthy` but the container is still up.** Docker
reports health but does not act on it — a hung server stays up and unhealthy
instead of restarting. Check `make logs`, then `make restart`. To automate it,
run [`willfarrell/autoheal`](https://github.com/willfarrell/autoheal) alongside.

**`A single server tick took 60.00 seconds` and the server kills itself.** The
vanilla watchdog firing during heavy worldgen, not a real deadlock. Set
`MAX_TICK_TIME=-1` in `.env` and `make restart`.

**Players are kicked for `Flying is not enabled on this server`.** A mod is
granting flight. Set `ALLOW_FLIGHT=TRUE` in `.env` and `make restart`.

**`You need to agree to the EULA`.** Set `EULA=TRUE` in `.env`, then
`make restart`.

**`OutOfMemoryError`, or the container gets killed.** Raise `MAX_MEMORY` and
`MEM_LIMIT`. More heap is not free, though — an oversized heap makes GC pauses
longer, which players feel as lag. Check real usage with `make stats` first.

**Low TPS.** `make tps` gives the per-dimension tick rate. To find the cause,
run spark **in game** as an operator: `/spark profiler start`, play for a few
minutes under load, then `/spark profiler stop` — it replies with a link to the
profile showing which mod is burning the tick.

> Spark answers the sender asynchronously, so its output never comes back
> through RCON — `make cmd C="spark ..."` runs the command but prints nothing.
> Use in-game chat. This is why there is no `make` target for it.

Lowering `VIEW_DISTANCE` and `SIMULATION_DISTANCE` is the fastest blunt fix.

**Client cannot connect / mod mismatch.** The client's NeoForge build and mod
list must match the server's. Server-only mods (spark, chunky) are fine to omit
client-side; anything that adds blocks or items is not.

**Mods are not downloading.** Check the Modrinth resolution step in the boot log.
A slug with no NeoForge build for your `MC_VERSION` aborts the boot — mark it
`slug?` to make it optional, or remove it.

**Reset the mod state.** `make clean-mods` wipes `server/data/mods` so the next boot
re-downloads everything. The world is untouched.

**Start over completely.** `make down && rm -rf server/data` — this deletes the world.
