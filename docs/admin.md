# 🎛️ Server Admin Panel

Operating the panel: what each page does, how accounts work, how to reach it.
For how it is built, see [admin/README.md](../admin/README.md).


---

A password-protected web UI at `https://$ADMIN_HOST`, organised as a real
dashboard with a sidebar:

| Section | Who sees it | What it does |
|---|---|---|
| Overview | everyone | TPS, players and CPU charts, plus a memory meter |
| Map | everyone | the BlueMap render, embedded |
| Mods | everyone | every mod in one table, linked to Modrinth, with the modpack download |
| Looks | everyone | shaders and resource packs known to work with this version |
| Guide | everyone | step-by-step setup for joining the server |
| Players | admin | one list: whitelist, panel accounts, operators and who is online |
| Console | admin | RCON commands with history, live tail of `latest.log` |
| Backups | admin | archives with size and age |
| Settings | admin | the effective `server.properties`, grouped |

Light / dark / system theme, toast feedback on every action, and a mobile
layout with bottom tabs.

> The CPU figure is the share of the **whole host**, 0-100. `docker stats`
> reports multiples of one core instead, so the same load reads as 480% there
> and 80% here on a six-core box. The tile says which it is.

### Accounts

There are two kinds of sign-in:

- **The admin from `.env`** (`ADMIN_USERNAME` / `ADMIN_PASSWORD`). Checked before
  the database, so a Postgres outage never locks you out of your own server.
- **Player accounts in Postgres**, created from the **Users** page.

Creating a player does three things in one step — makes the account, generates a
password, and adds the name to the whitelist over RCON. Passwords are stored only
as scrypt hashes, so no page can ever show an existing one back. What the field
on the Players page holds is a password you are *setting*: type one or generate
one, reveal it with the eye, copy it, save.

**Anyone the server already knows gets an account.** Opening the Players page
reconciles the two lists: every name in `whitelist.json` without an account gets
one as a `player`, every name in `ops.json` gets one as an `admin`. So people
seeded from `OPS` in `.env`, or added from the shell, can sign in
without anyone creating them by hand.

Operators are made admins on purpose — an op already has full control of the
world in game, so making the panel a second, separate grant would only be
bookkeeping. The upgrade is one-way: removing someone's op does not silently take
their panel account away.

Passwords for those backfilled accounts are random and never displayed, because
nobody typed them in. Use **Set password** on the Players page to give someone
one they can actually use.

**Accounts and the whitelist are still separate sets**, and the Players page
shows them merged rather than on two screens:

- an account without a whitelist entry means the RCON call failed when it was
  created — the badges make that visible instead of hiding it
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

Whitelist changes go out over RCON, so the server applies them immediately.
`OPS` in `.env` seeds `ops.json` on the first boot, and `EXISTING_OPS_FILE=SKIP`
keeps the startup script from overwriting what you changed at runtime. There is
no `WHITELIST` to match it: the panel owns that file, and whitelists every
operator the first time it reconciles — `ENFORCE_WHITELIST` applies to them too,
so a fresh server would otherwise turn its own owner away.

### ⚠️ In offline mode the panel owns the whitelist file

With `ONLINE_MODE=FALSE` a player's id is derived from their name, capitals
included — but the server derives it from a lower-cased copy of that name. So
`whitelist add Alex` writes an id `Alex` will never present, and the door stays
shut. Correcting the id afterwards is worse: `whitelist remove` looks names up
through the same lower-cased cache and then cannot find the entry either.

So the panel does not ask the server. It writes `whitelist.json` directly —
`server/data/whitelist.json` is the one path mounted writable into it — and
follows with `whitelist reload`, which the running server honours at once. Both
add and remove take effect before the request returns.

`make offline-ids` covers what the panel did not write: the `OPS` entries seeded
on the first boot, and anything added from the console. The playbook runs it
once, after the server finishes booting.


The console refuses `stop`, `restart`, `op` and `deop`. Taking the server down
or handing out operator rights belongs on the shell, where whoever does it can
see what else is running. Usernames are validated against
`^[A-Za-z0-9_]{3,16}$` before they are ever interpolated into an RCON command.

### 🔒 Security

- Sessions are HMAC-signed cookies (12 h, `HttpOnly`, `SameSite=Strict`), and
  every API handler re-verifies the signature rather than trusting middleware.
- Login is rate-limited to 8 attempts per 5 minutes per address; the password
  comparison is constant-time.
- Traefik adds HSTS, `frameDeny`, `nosniff` and a `same-origin` referrer policy.

> **The panel never touches the Docker socket.** It needs container stats, and
> the socket would be the obvious way to get them — but read-only on a *socket*
> is not a read-only *API*: anything that can talk to it can start a privileged
> container, which is root on the host. So a `socket-proxy` sits in front,
> answering `GET /containers` and refusing everything else with a 403. Drop the
> service and the panel keeps working, minus the CPU and memory readings.

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
