# Control panel

Next.js control panel for the Minecraft server. Built and run by the
`compose.yaml` in the repository root — see the main README for deployment.

## How it talks to the server

| Need | Mechanism | Why |
|---|---|---|
| Players, TPS, commands | RCON to `mc:25575` | live server state |
| Whitelist / ops listing | reads `whitelist.json` / `ops.json` from `/mcdata` | structured and authoritative; parsing `/whitelist list` would lose UUIDs |
| Whitelist changes | RCON `whitelist add/remove` | the server owns the file and reloads it itself |
| CPU / memory | Docker Engine API over `/var/run/docker.sock` | optional; the UI hides those readings when the socket is absent |

`src/lib/rcon.ts` implements the RCON protocol directly rather than pulling in a
dependency — it is four fields wide, and multi-packet replies need explicit
reassembly with a sentinel packet.

## Local development

The panel needs a reachable server. Point it at one over SSH port-forwarding or
a local stack:

```bash
export RCON_HOST=127.0.0.1 RCON_PORT=25575 RCON_PASSWORD=... \
       PANEL_PASSWORD=dev SESSION_SECRET=0123456789abcdef0123456789abcdef \
       MC_DATA_DIR=../server/data
npm run dev
```

Without a server the dashboard still renders and reports the server as
unreachable, which is the state worth designing against anyway.

## Charts

`src/components/LineChart.tsx` is hand-rolled SVG. The series colours in
`globals.css` come from a palette validated for colour-vision deficiency against
both glass surfaces; do not hand-tune them without re-validating.

Memory is a meter rather than a time series on purpose: Aikar's flags include
`AlwaysPreTouch`, so the whole heap is committed at startup and a memory line
chart would be flat forever.
