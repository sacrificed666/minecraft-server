# ⛏️ Minecraft Server — NeoForge 1.21.1 on Docker

A production-oriented, single-command modded Minecraft server: NeoForge on
Minecraft 1.21.1, a 50-mod Create pack declared in a text file, scheduled world
backups, and a web control panel behind TLS — all reproducible from this
repository.

Built on [`itzg/minecraft-server`](https://github.com/itzg/docker-minecraft-server),
[`itzg/mc-backup`](https://github.com/itzg/docker-mc-backup), Next.js and Traefik.

| Service | Image | Role |
|---|---|---|
| `mc` | `itzg/minecraft-server:stable-java21` | the server |
| `backups` | `itzg/mc-backup:stable` | consistent world snapshots over RCON |
| `admin` | built from `admin/` | Server Admin Panel: charts, whitelist, console |
| `postgres` | `postgres:18-alpine` | panel user accounts |
| `proxy` | `traefik:v3.7` | TLS and routing (opt-in profile) |

| Host | Serves | Through Traefik? |
|---|---|---|
| `server.sacrificed.me` | the Minecraft server, port 25565 | no — raw TCP, DNS only |
| `admin.sacrificed.me` | Server Admin Panel | yes |
| `map.sacrificed.me` | BlueMap web map | yes |

---

## Requirements

| | Minimum | Comfortable |
|---|---|---|
| CPU | 2 cores | 4+ cores — the main tick is single-threaded, so clock speed beats core count; extra cores go to worldgen and mods |
| RAM | 6 GB | 12 GB |
| Disk | 15 GB SSD | 40 GB SSD |
| Players | — | tuned here for ~5 concurrent, 10 slots |
| OS | any systemd Linux | Ubuntu 26.04 LTS (what this is deployed on) |
| Software | Docker Engine 24+ with the Compose plugin | |

Gameplay settings ship at the **vanilla `server.properties` defaults** —
survival, simulation distance 10, spawn protection 16 — with three deliberate
changes: `DIFFICULTY=hard`, `VIEW_DISTANCE` raised to 16, and `MAX_PLAYERS`
lowered to 10.

The whole thing is sized for a **small server: around 5 concurrent players on a
12 GB / 6-core host** (e.g. OVH VPS-3) running the 50-mod Create pack described
below. That player count is what buys the generous view distance — 16 costs
+147% loaded chunks per player over vanilla.

If you trim the pack down to a handful of mods, drop the heap to `6G` and
`MEM_LIMIT` to `8G`; the extra RAM does more good as page cache than as an
oversized heap.

Two vanilla defaults are worth revisiting once you have a mod list — see
`ALLOW_FLIGHT` and `MAX_TICK_TIME` in [Configuration](#configuration).

Install Docker on a fresh Ubuntu 26.04 VPS:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out and back in afterwards
```

---

## Quick start

```bash
git clone <this-repo> minecraft-server && cd minecraft-server

make init          # .env with generated RCON, panel and session secrets
nano .env          # set EULA=TRUE, OPS=<your-nickname>, ADMIN_HOST, ACME_EMAIL
make up            # start the server, backups and admin panel
make logs          # watch the boot
make proxy         # optional: Traefik for TLS on the admin panel
```

The **first boot takes 5–15 minutes**: it downloads the NeoForge installer, runs
it, fetches the mods, and generates the world. Later starts take under a minute.
The server is ready when the log shows `Done (…)! For help, type "help"`.

Connect from the game client at `<server-ip>:25565`.

> Your client needs the **same NeoForge build and the same mods** as the server.
> Read the build off the boot log, or run `make cmd C="neoforge mods"`.

Without `make`:

```bash
cp .env.example .env && nano .env
docker compose up -d
docker compose logs -f minecraft
```

---

## Configuration

Everything is driven by `.env` — `compose.yaml` should rarely need edits. See
[`.env.example`](.env.example) for the annotated list. The settings that matter
most:

| Variable | Default | Notes |
|---|---|---|
| `EULA` | `FALSE` | Must be `TRUE`. You are accepting the [Minecraft EULA](https://www.minecraft.net/eula). |
| `MC_VERSION` | `1.21.1` | Changing it on an existing world upgrades or corrupts it — back up first. |
| `NEOFORGE_VERSION` | *(empty)* | Empty = latest stable for `MC_VERSION`. **Pin it** once your mods work. |
| `MAX_MEMORY` | `8G` | JVM heap. Keep `INIT_MEMORY` equal to it (Aikar's flags assume a fixed heap) and `MEM_LIMIT` ~25% above. |
| `VIEW_DISTANCE` | `16` | Raised from the vanilla `10`. The biggest single lever on server load — drop to `10`–`12` if TPS suffers or you raise `MAX_PLAYERS`. |
| `MAX_PLAYERS` | `10` | Lowered from the vanilla `20`; headroom over the expected ~5 concurrent players. |
| `DIFFICULTY` | `hard` | Raised from the vanilla `easy`. Server-wide — Minecraft has no per-player difficulty. |
| `ALLOW_FLIGHT` | `FALSE` | Vanilla default. **Set to `TRUE` if any mod grants flight** (jetpacks, wings) — otherwise those players get kicked. |
| `MAX_TICK_TIME` | `60000` | Vanilla watchdog. Set to `-1` if a heavy pack trips it during worldgen. |
| `OPS` | *(empty)* | Comma-separated admin nicknames. |
| `WHITELIST` | *(empty)* | Comma-separated. Also set `ENFORCE_WHITELIST=true`. |
| `RCON_PASSWORD` | *(generated)* | Required. `make init` fills it in. |

Changed something? `make restart`.

Anything without a variable can be edited directly in `server/data/server.properties`.
Note that `OVERRIDE_SERVER_PROPERTIES=true` re-applies the variables above on
every start, so for *those* keys you must edit `.env`, not the file.

> **Vanilla parity.** The generated `server/data/server.properties` was diffed against
> the file produced by the official Mojang 1.21.1 server jar: all 61 keys match,
> except `enable-rcon=true` and `rcon.password` (required by the backup sidecar
> and `make cmd`), plus `difficulty`, `view-distance` and `max-players` as tuned
> in `.env`.
>
> The file only holds 18 keys until the server finishes its first boot; Minecraft
> fills in the remaining defaults itself on load. Don't judge it mid-startup.

---

## The mod pack

This is a **Create-focused pack**: Create 6 plus 44 of its most-downloaded
NeoForge addons, three performance mods and two server tools — 50 entries that
pull 59 jars in total once dependencies are resolved.

The whole set was boot-tested together on NeoForge 21.1.248: clean start, no mod
errors, 20.0 TPS idle. See [`server/mods.txt`](server/mods.txt) for the grouped
list.

**Every player needs the same mods and the same NeoForge build.** Almost all of
these add blocks and items, so a client without them cannot join.

### Managing mods

[`server/mods.txt`](server/mods.txt) is the single source of truth. Every mod
comes from Modrinth — there is no manual jar directory and no CurseForge
fallback, which keeps the pack fully reproducible from this repository.

Add the project slug, one per line, then `make restart`. The slug is the last
part of the project URL — `modrinth.com/mod/`**`create`**. Required dependencies
are resolved automatically. Removing a line removes the mod on the next restart.

Pin an exact build when you need reproducibility — the version ID comes from the
Modrinth version page URL:

```
create:6RGoOKrN
```

Two gotchas the current list already works around:

- **`:beta` is mandatory** where a project has no release build for 1.21.1.
  The resolver only considers releases, so `create-goggles` and
  `create-railways-navigator` would silently fail to install without it.
- **Dependency resolution follows the same rule.** `create-railways-navigator`
  needs `dragonlib`, which is beta-only — so `dragonlib:beta` has to be listed
  explicitly, or the server crashes at boot with a missing-dependency error.

Keep comments on their own lines; a trailing `#` on a slug line is not stripped.

> **If you ever need a mod that is not on Modrinth**, re-add the bind mount
> `- ./mods:/mods:ro` and `COPY_MODS_SRC: "/mods"` to `compose.yaml`, then drop
> the jar in `./mods/`. Note the asymmetry that made it worth removing: adding a
> jar there is automatic, but deleting one is not — the copy already made in
> `/data/mods` inside the container has to be removed by hand.

### Giving players the mods

Players need the same jars the server runs. `make modpack` collects them into
`server/modpack/`, skipping the server-only tools listed in
[`server/server-only-mods.txt`](server/server-only-mods.txt) — spark, chunky and
BlueMap do nothing in a client.

```bash
make modpack     # → server/modpack/modpack.zip
```

The panel serves it from the **Mods** page, so players can be pointed at a
download link instead of a chat message full of Modrinth URLs. Rebuild it after
any change to `server/mods.txt`.

### Before you add anything

- The project must have a **NeoForge** build for your `MC_VERSION`. Fabric-only
  and Forge-only jars will not load.
- Check the project's **server side** on Modrinth. Client-only mods (Sodium,
  Iris, minimaps, shaders, and FPS mods like CreateBetterFps) do nothing here
  and can break the boot.
- A mod whose dependency is not on Modrinth cannot be used at all. Create
  Ultimine is the example: it requires FTB Ultimine, which is CurseForge-only.
- Add mods a few at a time. When the server refuses to start, the crash log in
  `server/data/crash-reports/` names the culprit — a wall of 40 new mods does not.

---

## Everyday operations

`make help` lists everything, grouped. The common ones:

```bash
make up            # start
make down          # stop (the world in ./server/data is kept)
make restart       # re-read .env and mods.txt
make logs          # follow the log
make status        # container state and health
make stats         # live CPU / RAM
make disk          # space used by world and backups
make players       # who is online
make tps           # server tick rate
make mods          # installed mod jars
```

`make up` and `make restart` refuse to run without a `.env` and warn when
`EULA` is not `TRUE`.

### Running commands

```bash
make cmd C="say Server restarting in 5 minutes"
make cmd C="op Steve"
make cmd C="whitelist add Alex"
make rcon          # interactive RCON prompt
make console       # full server console — detach with Ctrl-P Ctrl-Q
```

> In `make console`, **Ctrl-C stops the server.** Detach with Ctrl-P Ctrl-Q.
> `make rcon` is the safer default.

### Pre-generating the world

Worldgen is the most expensive thing a modded server does, and doing it while
players explore is what produces lag spikes. The bundled `chunky` mod does it up
front:

```bash
make pregen R=3000               # set radius and start
make cmd C="chunky progress"     # check on it
```

---

## DNS

Three A records, all pointing at the VPS:

```
server.sacrificed.me   A   <vps-ip>
admin.sacrificed.me    A   <vps-ip>
map.sacrificed.me      A   <vps-ip>
```

Only the last two go through Traefik. Minecraft speaks its own TCP protocol on
25565, so `server.sacrificed.me` needs nothing but the record — players type it
straight into the client.

> Point the records at the host **before** `make proxy`. Let's Encrypt validates
> over HTTP, so a name that does not resolve yet fails the challenge, and
> repeated failures hit rate limits.

---

## The map

BlueMap renders the world into a browsable 3D map at `https://$MAP_HOST`, and
the admin panel embeds it under **Map**.

Two things make it work, both already set:

- **`accept-download: true`** in [`server/bluemap/core.conf`](server/bluemap/core.conf).
  BlueMap needs Mojang's client jar for block models and textures and refuses to
  fetch it without consent. The default is `false`, and a server that misses this
  looks like BlueMap silently doing nothing.
- **`render-thread-count: 2`.** Rendering competes with the server tick. Two
  threads on a 6-core host leaves the game responsive; raising it makes the first
  render faster and the server choppier.

The first full render of an existing world takes a while. Watch it with
`make cmd C="bluemap status"`.

> BlueMap's output lives under `server/data/` and can reach gigabytes. It is
> excluded from backups on purpose — it is fully regenerable from the world, and
> including it would multiply every archive.

---

## Server Admin Panel

A password-protected web UI at `https://$ADMIN_HOST`, organised as a real
dashboard with a sidebar:

| Section | Who sees it | What it does |
|---|---|---|
| Overview | everyone | TPS / players / CPU charts, memory meter, quick actions |
| Map | everyone | the BlueMap render, embedded |
| Mods | everyone | installed jars, and the modpack download |
| Guide | everyone | step-by-step setup for joining the server |
| Players | admin | one list: whitelist, panel accounts, operators and who is online |
| Console | admin | RCON commands with history, live tail of `latest.log` |
| Backups | admin | archives with size and age |
| Settings | admin | the effective `server.properties`, grouped |

Light / dark / system theme, toast feedback on every action, and a mobile
layout with bottom tabs.

### Accounts

There are two kinds of sign-in:

- **The admin from `.env`** (`ADMIN_USERNAME` / `ADMIN_PASSWORD`). Checked before
  the database, so a Postgres outage never locks you out of your own server.
- **Player accounts in Postgres**, created from the **Users** page.

Creating a player does three things in one step — makes the account, generates a
password, and adds the name to the whitelist over RCON. The password is shown
once and stored only as a scrypt hash; if it is lost, reset it and a new one is
generated.

**Accounts and the whitelist are separate sets**, and the Players page shows
them merged rather than on two screens:

- an account without a whitelist entry means the RCON call failed when it was
  created — the badges make that visible instead of hiding it
- a whitelist entry without an account is someone added from the shell, or
  seeded from `WHITELIST` in `.env`
- **Whitelist only** adds someone who should be able to play but not sign in

That is why there is one page and not two: the alternative was making the admin
join those lists in their head.

Players get the four public sections. Everything else returns `403` at the API,
not just hidden in the nav — the menu is convenience, the API is the boundary.

> Deleting a user offers to remove them from the whitelist too, so revoking
> access is also one step rather than two.

```bash
make admin-password    # show the bootstrap admin password
make admin             # rebuild and restart it
make admin-logs        # follow its log
make proxy             # start Traefik (TLS) — needs ports 80/443 free
```

`make init` generates `ADMIN_PASSWORD`, `SESSION_SECRET` and `POSTGRES_PASSWORD`. Set `ADMIN_HOST` to
a name that resolves to this host and `ACME_EMAIL` to a real address before
starting the proxy, or Let's Encrypt cannot issue a certificate.

### Reaching it without a domain

The panel also publishes port 3000 on **loopback only** (`ADMIN_BIND=127.0.0.1`),
so you can reach it over an SSH tunnel without exposing it or waiting for DNS:

```bash
ssh -L 3000:127.0.0.1:3000 ubuntu@<vps-ip>
# then open http://localhost:3000
```

Setting `ADMIN_BIND=0.0.0.0` publishes it to the world **without TLS** — the
password would cross the network in clear text. Use it only behind a VPN, or
locally.

### What it can and cannot do

Whitelist changes go out over RCON, so the server applies them immediately and
writes them to `whitelist.json` itself — no restart, no drift. `OPS` and
`WHITELIST` in `.env` only seed those files on first boot; afterwards
`EXISTING_WHITELIST_FILE=SKIP` keeps the startup script from overwriting what
you changed at runtime.

> Without that setting the image rewrites `whitelist.json` from `.env` on every
> restart, and every player added through the admin panel would silently disappear.

The console refuses `stop`, `restart`, `op` and `deop`. Taking the server down
or handing out operator rights belongs on the shell, where whoever does it can
see what else is running. Usernames are validated against
`^[A-Za-z0-9_]{3,16}$` before they are ever interpolated into an RCON command.

### Security

- Sessions are HMAC-signed cookies (12 h, `HttpOnly`, `SameSite=Strict`), and
  every API handler re-verifies the signature rather than trusting middleware.
- Login is rate-limited to 8 attempts per 5 minutes per address; the password
  comparison is constant-time.
- Traefik adds HSTS, `frameDeny`, `nosniff` and a `same-origin` referrer policy.

> **The Docker socket is the real risk here.** The panel mounts
> `/var/run/docker.sock` read-only to read CPU and memory. Read-only on a socket
> is *not* a read-only API — anything that can talk to it can start privileged
> containers, which is root on the host. If you would rather not accept that,
> delete the socket mount and the `group_add` line from the `admin` service: the
> panel keeps working and simply hides the CPU and memory readings.

The panel runs as `PUID:PGID` rather than its image's own user, because the
server creates `server/data` without the world-execute bit — any other uid gets
`Permission denied` and the whitelist reads back empty.

### The database

Postgres 18 holds nothing but panel accounts — the world, whitelist and mod list
all stay in files, so losing the database costs you the accounts and nothing
else. It is never published on a port; only the panel reaches it over the
internal network.

```bash
docker compose exec postgres psql -U admin -d admin -c '\dt'
```

> Postgres 18 wants the **parent** directory mounted (`/var/lib/postgresql`),
> not `data/` inside it. With the old path the container refuses to start,
> reporting data in an "unused mount/volume". The compose file already uses the
> new layout.

`POSTGRES_DB`, `POSTGRES_USER` and `POSTGRES_PASSWORD` are only read when the
volume is **first** initialised. Changing them later has no effect until the
volume is recreated, which also drops the accounts:

```bash
docker compose down
docker volume rm minecraft_postgres
make up
```

---

## Backups

The `backups` sidecar runs `save-off` → archive → `save-on` over RCON, so
snapshots are consistent. Defaults: **once a day, kept 3 days**, skipped
entirely if nobody has been online since the last one.

That retention is deliberate. A mature modded world runs to several GB, so a
6-hourly / 7-day schedule would keep 28 archives and could fill a 100 GB disk on
its own. Three daily archives cover the realistic case — "yesterday's world was
fine" — at a tenth of the cost.

```bash
make backup        # run one immediately
make backups       # list archives
```

Tune `BACKUP_INTERVAL` and `PRUNE_BACKUPS_DAYS` in `.env`.

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

## Updating

```bash
make update        # pull newer images, recreate the container
```

This picks up base-image fixes and re-resolves `server/mods.txt`. With
`NEOFORGE_VERSION` empty it may also move you onto a newer NeoForge build —
which is exactly why you should pin it once the server is stable.

**Take a backup before any update that touches mods or the MC version.** Mod
updates can and do change world data irreversibly.

---

## Security

The compose file publishes RCON on `127.0.0.1` only. An internet-exposed RCON
port hands a full remote console to anyone who guesses the password — keep
`RCON_BIND=127.0.0.1` unless there is a VPN in front of it.

Open only the game port on the firewall:

```bash
sudo ufw allow 25565/tcp        # game
sudo ufw allow 80,443/tcp       # panel + Let's Encrypt challenge
sudo ufw enable
```

Keep `ONLINE_MODE=TRUE`. With it off, anyone can connect under any nickname —
including yours, and yours is an operator.

`.env` holds the RCON password, the admin password and the session secret. It\nis git-ignored; keep it that way.

---

## Auto-start on the VPS

`restart: unless-stopped` brings the server back after a crash or a reboot,
provided the Docker daemon itself starts at boot:

```bash
sudo systemctl enable docker
```

---

## Provisioning with Ansible

[`ansible/`](ansible/) takes a fresh Ubuntu 26.04 host to a running stack. Every
task is idempotent, and only `ansible.builtin` modules are used, so nothing has
to be installed from Galaxy first.

```bash
make provision-check              # dry run, shows the diff
make provision                    # apply
```

[`ansible/inventory.yml`](ansible/inventory.yml) is committed and already
points at `server.sacrificed.me`. Nothing in it is secret — the hostnames are
public DNS records, the repository is public, and every password is generated
on the server by `make init`. Edit it directly to target a different host.

> Running from a Codespace prints *"world writable directory ... ignoring it as
> an ansible.cfg source"*. Harmless: the playbook finds its roles relative to
> `site.yml` either way, and it does not happen on a normal checkout.

Five roles, each with its own defaults, run in order:

| Role | Tag | What it does |
|---|---|---|
| `common` | `common` | timezone, packages, unattended upgrades, deploy user, swap, file limits |
| `hardening` | `hardening` | SSH drop-in: no root login, no passwords, `MaxAuthTries` |
| `docker` | `docker` | Docker CE from upstream plus the Compose plugin, daemon log caps |
| `firewall` | `firewall` | ufw: SSH, 25565, 80, 443, default deny inbound |
| `minecraft` | `deploy` | clone, `make init`, apply `env_overrides`, start the stack, build the modpack |

Run one on its own with `--tags`, e.g.
`ansible-playbook -i inventory.yml site.yml --tags firewall`. Roles assume the
earlier ones have run at least once — `firewall` needs ufw from `common`,
`minecraft` needs Docker.

Everything tunable lives in `roles/*/defaults/main.yml`; the inventory only
carries what differs for your host.

Two deliberate choices:

- **Secrets are generated on the host.** The playbook runs `make init` there; the
  passwords never pass through Ansible, the repository or CI. Only non-secret
  values (hostnames, `OPS`, `MOTD`) come from `env_overrides` in the inventory.
- **The playbook refuses to start the server if `EULA` is not `TRUE`.** Accepting
  Mojang's licence is a decision for a person, not for automation. Set it in
  `env_overrides` once you have read it.

---

## The deployment pipeline

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) is
**manual only** (`workflow_dispatch`). A push never deploys: restarting the
server drops whoever is playing, and that should be somebody's decision.

Run it from the Actions tab and pick a target:

| Target | Effect |
|---|---|
| `admin` | rebuilds the panel with `--no-deps` — **players stay connected** |
| `stack` | recreates every service; the server restarts |
| `modpack` | rebuilds `modpack.zip` from the installed jars |

It lints and builds the panel and validates `compose.yaml` **before** touching
the server, then pulls the branch, applies, and waits for the panel to report
healthy — failing the run with the last 50 log lines if it does not.

### Setting it up

Repository secrets:

| Secret | What |
|---|---|
| `SSH_HOST` | the server address |
| `SSH_USER` | the deploy user (`mc` by default) |
| `SSH_KEY` | a private key whose public half is in that user's `authorized_keys` |
| `SSH_KNOWN_HOSTS` | the server's host key — see below |
| `SSH_PORT` | optional, defaults to 22 |

And a repository variable `DEPLOY_PATH` if the checkout is not at
`/opt/minecraft-server`.

#### Why `SSH_KNOWN_HOSTS`

SSH authenticates in both directions: the key proves who the runner is, the
host key proves the machine answering is really your server. A fresh CI runner
has an empty `known_hosts`, so it has nothing to check the second half against.

That leaves three options, and only one is safe:

| | What happens |
|---|---|
| `StrictHostKeyChecking no` | connects to whatever answers on that address |
| `ssh-keyscan` at run time | asks the stranger for their key, then trusts it — the same thing, dressed up |
| **pinned `SSH_KNOWN_HOSTS`** | connects only to the machine holding the key you recorded |

Without it, anyone able to redirect that hostname (DNS, BGP, a takeover of the
address after the VPS is destroyed) receives your deployment session — commands
executed as the deploy user, which is in the `docker` group, which is root.

Generate it **from a machine you already trust**, once:

```bash
ssh-keyscan -H server.sacrificed.me
```

Paste the whole output into the secret. It changes only if the server is
rebuilt, in which case update the secret then.

**CI never sees the server's secrets.** `.env` is created on the host by Ansible
and stays there; the pipeline only runs git and compose commands over SSH.

`make release` does the same deployment from your own machine, through Ansible,
if you would rather not go through GitHub.

---

## Deploying on OVHcloud VPS

Notes specific to an OVH VPS (written against **VPS-3**: 6 vCore, 12 GB RAM,
100 GB NVMe, 2 Gbps, anti-DDoS included — the size the defaults target).

**1. Base setup.** Pick **Ubuntu 26.04 LTS** at install time and add your SSH key
in the OVH panel. Then harden the login:

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
EOF
sudo systemctl restart ssh
```

> Ubuntu 26.04 ships a drop-in directory and socket-activated SSH. Writing a
> drop-in survives package upgrades, which editing `sshd_config` in place does
> not.

**2. Firewall.** Open only SSH and the game port. Do this *before* the first
`make up` — `ufw enable` over SSH without allowing 22 first locks you out.

```bash
sudo ufw allow 22/tcp
sudo ufw allow 25565/tcp
sudo ufw allow 80,443/tcp
sudo ufw enable
```

> Docker publishes ports by writing iptables rules that bypass ufw's `INPUT`
> chain, so a published port is reachable even when ufw claims to deny it. The
> compose file avoids the trap by binding RCON to `127.0.0.1` rather than
> relying on the firewall. For defence in depth, add a rule in the **OVH Network
> Firewall** (panel → the VPS → *IP* tab), which filters upstream of the host.

**3. Deploy.**

```bash
ssh ubuntu@<vps-ip>
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER" && exec su -l "$USER"

git clone <this-repo> minecraft-server && cd minecraft-server
make init && nano .env      # EULA=TRUE, OPS=<your-nick>
make up && make logs
```

**4. Disk budget.** Daily archives kept 3 days means at most 3 copies of the
world, plus the world itself and BlueMap's render. On 100 GB that is comfortable
even for a large modded world. Watch it with `make disk`.

**5. Watch the disk anyway.** `make disk` shows the world and archive sizes. If
they grow faster than expected, `PRUNE_BACKUPS_DAYS` is the lever.

**6. OVH's own backups are not a substitute.** The included daily snapshot is a
whole-disk image on OVH's side — good for "the VPS died", useless for "restore
yesterday's world after a bad mod update", and gone if the account is. Keep the
sidecar running and sync `server/backups/` off-host.

**7. Anti-DDoS is always on** and needs no configuration. It absorbs volumetric
floods; it does not stop application-level abuse, so keep the whitelist in mind
if the server is public.

---

## Troubleshooting

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

---

## Layout

```
compose.yaml           # all five services
.env                   # your configuration            (git-ignored)
.env.example           # annotated template
Makefile               # operational shortcuts
server/
  mods.txt             # declarative Modrinth mod list — the whole mod set
  server-only-mods.txt # jars excluded from the player modpack
  bluemap/             # BlueMap config, mounted read-only over the defaults
  data/                # world, mod configs, logs      (git-ignored)
  backups/             # world archives                (git-ignored)
  modpack/             # built player modpack          (git-ignored)
admin/                 # Server Admin Panel (Next.js)
  Dockerfile
  src/lib/             # RCON client, sessions, users, metrics collector
  src/components/      # shell, charts, toasts, theme
  src/app/api/         # auth, metrics, users, whitelist, console, modpack
ansible/
  site.yml             # the playbook: five roles, in order
  group_vars/all.yml   # values shared by every host
  roles/               # common, hardening, docker, firewall, minecraft
  inventory.yml        # the host and its hostnames
.github/workflows/
  deploy.yml           # manual deployment pipeline
```

There is no Traefik config file: the proxy is configured entirely through flags
in `compose.yaml`, and its certificates live in a named volume.
