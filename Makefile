.DEFAULT_GOAL := help
SHELL := /bin/bash
COMPOSE := docker compose
SERVICE := minecraft

# User arguments: make cmd C="say hi" | make pregen R=3000 | make restore F=...
R ?= 10000

# Colour by meaning, not decoration.
BOLD := \033[1m
DIM  := \033[2m
CYAN := \033[36m
GRN  := \033[32m
YEL  := \033[33m
RED  := \033[31m
MAG  := \033[35m
RST  := \033[0m

.PHONY: help check init up down restart logs status health stats players tps \
        disk console rcon cmd pregen seed save backup backups restore offline-ids \
        pull update rebuild mods clean-mods config admin admin-logs admin-password map \
        modpack client-mods proxy urls map-render map-pause \
        provision provision-lint provision-check release \
        vault-check vault-edit vault-rekey host-key

##@ General

help: ## ❓ Show this help
	@printf "\n$(BOLD)⛏️  Minecraft$(RST) $(DIM)NeoForge $$(grep '^MC_VERSION=' .env 2>/dev/null | cut -d= -f2)$(RST)\n"
	@printf "$(DIM)   make <target>$(RST)\n"
	@awk 'BEGIN {FS = ":.*##"} \
		/^##@/ {printf "\n$(BOLD)$(MAG)%s$(RST)\n", substr($$0, 5)} \
		/^[a-z][a-z-]*:.*##/ {printf "  $(CYAN)%-15s$(RST) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n$(DIM)  Arguments: $(RST)$(CYAN)C$(RST)$(DIM)=command  $(RST)$(CYAN)R$(RST)$(DIM)=radius  $(RST)$(CYAN)F$(RST)$(DIM)=file$(RST)\n\n"

check:
	@test -f .env || { printf "$(RED)✗ .env is missing$(RST) — run $(CYAN)make init$(RST)\n"; exit 1; }
	@grep -q '^EULA=TRUE' .env || printf "$(YEL)⚠  EULA is not TRUE in .env — the server will refuse to start$(RST)\n"
	@# compose mounts single files into these; Docker would create whatever is
	@# missing itself, as root, and the server could not write its own configs
	@mkdir -p server/data/config/bluemap server/data/config/chunky server/modpack server/backups
	@test -s server/data/whitelist.json || echo '[]' > server/data/whitelist.json

##@ Setup

init: ## 🔧 Create .env with generated secrets
	@test ! -f .env || { printf "$(RED)✗ .env already exists$(RST) — not overwriting\n"; exit 1; }
	@cp .env.example .env
	@sed -i "s|^RCON_PASSWORD=.*|RCON_PASSWORD=$$(openssl rand -base64 24)|" .env
	@sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$$(openssl rand -base64 18)|" .env
	@sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$$(openssl rand -hex 32)|" .env
	@sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)|" .env
	@sed -i "s|^PUID=.*|PUID=$$(id -u)|" .env
	@sed -i "s|^PGID=.*|PGID=$$(id -g)|" .env
	@printf "$(GRN)✓ .env created$(RST) with generated RCON, admin and session secrets\n"
	@printf "  Next: set $(CYAN)EULA=TRUE$(RST), $(CYAN)OPS=<nick>$(RST), $(CYAN)ADMIN_HOST$(RST), then $(CYAN)make up$(RST)\n"
	@printf "  Admin password: $(CYAN)make admin-password$(RST)\n"

up: check ## ▶️  Start the server, backups and admin panel
	@$(COMPOSE) up -d
	@printf "$(GRN)✓ starting$(RST) — first boot takes 5-15 min. Follow with $(CYAN)make logs$(RST)\n"

down: ## ⏹️  Stop and remove containers (the world is kept)
	@$(COMPOSE) down
	@printf "$(GRN)✓ stopped$(RST) — world preserved in ./server/data\n"

restart: check ## 🔄 Restart, re-applying .env and mods.txt
	@$(COMPOSE) up -d --force-recreate $(SERVICE)
	@printf "$(GRN)✓ restarted$(RST)\n"

##@ Monitoring

logs: ## 📜 Follow the server log
	@$(COMPOSE) logs -f --tail=200 $(SERVICE)

status: ## 🩺 Container state and health
	@$(COMPOSE) ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'

health: ## ❤️  Wait until the admin panel reports healthy
	@for i in $$(seq 1 30); do \
	   state=$$(docker inspect minecraft-admin --format '{{.State.Health.Status}}' 2>/dev/null || echo missing); \
	   if [ "$$state" = healthy ]; then \
	     printf "$(GRN)✓ panel healthy$(RST) $(DIM)after %ss$(RST)\n" "$$((i * 5 - 5))"; exit 0; \
	   fi; \
	   printf "$(DIM)  %2s/30  %s$(RST)\n" "$$i" "$$state"; \
	   sleep 5; \
	 done; \
	 printf "$(RED)✗ panel did not become healthy in 150s$(RST)\n"; \
	 $(COMPOSE) ps; $(COMPOSE) logs --tail=50 admin; exit 1

urls: ## 🔗 Show the configured addresses
	@printf "  $(BOLD)Minecraft$(RST)  $(CYAN)%s$(RST):%s\n" "$$(grep '^SERVER_HOST=' .env | cut -d= -f2)" "$$(grep '^SERVER_PORT=' .env | cut -d= -f2)"
	@printf "  $(BOLD)Admin$(RST)      $(CYAN)https://%s$(RST)\n" "$$(grep '^ADMIN_HOST=' .env | cut -d= -f2)"
	@printf "  $(BOLD)Map$(RST)        $(CYAN)https://%s$(RST)\n" "$$(grep '^MAP_HOST=' .env | cut -d= -f2)"

stats: ## 📊 Live CPU and memory usage
	@docker stats minecraft minecraft-backups minecraft-admin

players: ## 👥 List online players
	@$(COMPOSE) exec -T $(SERVICE) rcon-cli list

# The panel writes whitelist.json itself and gets offline ids right. This fixes
# what it did not write: the OPS entries seeded on the very first boot,
# whose ids the server derives from a lower-cased name.
offline-ids: ## 🪪 Correct seeded whitelist/ops ids for ONLINE_MODE=FALSE
	@if ! grep -q '^ONLINE_MODE=FALSE' .env; then \
	   printf "$(YEL)⚠  ONLINE_MODE is not FALSE — nothing to do$(RST)\n"; exit 0; \
	 fi; \
	 accounts=$$($(COMPOSE) exec -T postgres psql -qtAX \
	     -U "$$(grep '^POSTGRES_USER=' .env | cut -d= -f2)" \
	     -d "$$(grep '^POSTGRES_DB=' .env | cut -d= -f2)" \
	     -c 'SELECT username FROM users' 2>/dev/null); \
	 seeded=$$(grep '^OPS=' .env | cut -d= -f2 | tr ',' '\n'); \
	 out=$$(printf '%s\n%s\n' "$$accounts" "$$seeded" | python3 scripts/offline-ids.py \
	     server/data/whitelist.json server/data/ops.json); \
	 if [ -n "$$out" ]; then \
	   printf '%s\n' "$$out"; \
	   $(COMPOSE) exec -T $(SERVICE) rcon-cli whitelist reload >/dev/null 2>&1 || true; \
	   printf "$(GRN)✓ ids corrected$(RST)\n"; \
	 fi

tps: ## ⚡ Server tick rate, per dimension
	@$(COMPOSE) exec -T $(SERVICE) rcon-cli neoforge tps

disk: ## 💽 Disk used by the world and backups
	@du -sh server/data server/backups 2>/dev/null || true
	@df -h . | tail -1

##@ Console

console: ## 🖥️  Attach to the live server console
	@printf "$(YEL)⚠  Detach with Ctrl-P then Ctrl-Q. Ctrl-C would STOP the server.$(RST)\n"
	@docker attach minecraft

rcon: ## 🎮 Interactive RCON prompt
	@$(COMPOSE) exec $(SERVICE) rcon-cli

cmd: ## 💬 Run one command — make cmd C="say hello"
	@test -n "$(C)" || { printf "$(RED)usage:$(RST) make cmd C=\"say hello\"\n"; exit 1; }
	@$(COMPOSE) exec -T $(SERVICE) rcon-cli $(C)

##@ World

pregen: ## 🗺️  Pre-generate the world — radius in BLOCKS, e.g. R=3000
	@$(COMPOSE) exec -T $(SERVICE) rcon-cli chunky radius $(R)
	@$(COMPOSE) exec -T $(SERVICE) rcon-cli chunky start
	@printf "$(GRN)✓ pre-generating radius $(R)$(RST) — check with $(CYAN)make cmd C=\"chunky progress\"$(RST)\n"

seed: ## 🌱 Show the world seed
	@$(COMPOSE) exec -T $(SERVICE) rcon-cli seed

save: ## 💾 Force a world save
	@$(COMPOSE) exec -T $(SERVICE) rcon-cli save-all flush
	@printf "$(GRN)✓ world saved$(RST)\n"

##@ Backups

backup: ## 📦 Trigger a backup right now
	@$(COMPOSE) exec -T backups backup now
	@printf "$(GRN)✓ backup done$(RST)\n"

backups: ## 🗂️  List backup archives
	@ls -lh server/backups/ 2>/dev/null || printf "$(DIM)no backups yet$(RST)\n"

restore: ## ♻️  Restore a backup — make restore F=server/backups/...tar.gz
	@test -n "$(F)" || { printf "$(RED)usage:$(RST) make restore F=server/backups/world-20260809-030000.tar.gz\n"; exit 1; }
	@test -f "$(F)" || { printf "$(RED)✗ no such file:$(RST) $(F)\n"; exit 1; }
	@printf "$(RED)This replaces the current world with $(F)$(RST)\n"
	@read -p "Type 'yes' to continue: " a; [ "$$a" = "yes" ] || { printf "$(DIM)aborted$(RST)\n"; exit 1; }
	@$(COMPOSE) stop $(SERVICE)
	@if [ -d server/data/world ]; then \
	   ts=$$(date +%Y%m%d-%H%M%S); mv server/data/world "server/data/world.before-restore-$$ts"; \
	   printf "$(DIM)old world kept at server/data/world.before-restore-$$ts$(RST)\n"; \
	 fi
	@tar -xzf "$(F)" -C server/data/
	@$(COMPOSE) start $(SERVICE)
	@# tar replaces whitelist.json rather than rewriting it, and the panel has
	@# that single file bind-mounted — without this it writes to a dead inode
	@$(COMPOSE) up -d --force-recreate --no-deps admin
	@printf "$(GRN)✓ restored$(RST)\n"

##@ Maintenance

pull: ## ⬇️  Pull newer base images
	@$(COMPOSE) pull

update: pull ## ⬆️  Pull images and recreate the server
	@$(COMPOSE) up -d
	@printf "$(GRN)✓ updated$(RST) — mods re-resolved from server/mods.txt\n"

rebuild: check ## 🏗️  Rebuild local images and recreate every service
	@$(COMPOSE) up -d --build
	@printf "$(GRN)✓ stack rebuilt$(RST) — the server restarted\n"

mods: ## 🧩 List installed mod jars
	@ls -1 server/data/mods/ 2>/dev/null || printf "$(DIM)not installed yet — run make up$(RST)\n"

clean-mods: ## 🧹 Wipe server/data/mods so the next boot re-downloads
	@# Only the server: `down` would take the panel and the database with it
	@$(COMPOSE) stop $(SERVICE)
	@rm -rf server/data/mods
	@printf "$(GRN)✓ server/data/mods removed$(RST) — run $(CYAN)make up$(RST) to re-resolve\n"

config: ## 🔍 Validate and print the resolved compose config
	@$(COMPOSE) config

##@ Provisioning

# group_vars/all/vault.yml holds the host password.
VAULT     := ansible/.vault-pass
VAULT_ARG := --vault-password-file .vault-pass
# Natively where Ansible is installed, in a container where it is not.
ANSIBLE   := scripts/ansible.sh
vault-check:
	@if [ ! -f $(VAULT) ]; then \
	   printf "$(RED)✗ $(VAULT) is missing$(RST) — it is never committed.\n"; \
	   printf "$(DIM)  Restore it from your password manager, then run this again.$(RST)\n"; \
	   exit 1; \
	 fi

# Host key verification stays on, so the first connection needs the key on record.
host-key: ## 🔑 Trust the server's SSH host key — compare it with the provider's console
	@host=$$(awk '/ansible_host:/ {print $$2; exit}' ansible/inventory.yml); \
	 mkdir -p ~/.ssh; \
	 if ssh-keygen -F "$$host" >/dev/null 2>&1; then \
	   printf "$(GRN)✓ host key known$(RST) $(DIM)$$host$(RST)\n"; \
	 else \
	   ssh-keyscan -H "$$host" 2>/dev/null >> ~/.ssh/known_hosts; \
	   printf "$(YEL)⚠  recorded the host key for $$host$(RST) — compare with the provider:\n"; \
	   ssh-keyscan "$$host" 2>/dev/null | ssh-keygen -lf - | sed 's/^/  /'; \
	 fi

provision: vault-check host-key ## 🏗️  Prepare the server with Ansible
	@$(ANSIBLE) ansible-playbook -i inventory.yml site.yml $(VAULT_ARG)

provision-lint: ## 🔍 Syntax-check the playbook — needs no host and no vault
	@$(ANSIBLE) ansible-playbook -i inventory.yml site.yml --syntax-check
	@printf "$(GRN)✓ playbook parses$(RST)\n"

provision-check: vault-check ## 🩺 Dry-run the playbook against the host, with a diff
	@$(ANSIBLE) ansible-playbook -i inventory.yml site.yml --check --diff $(VAULT_ARG)

release: vault-check ## 🚀 Pull and restart on the server (what the pipeline runs)
	@$(ANSIBLE) ansible-playbook -i inventory.yml site.yml --tags deploy $(VAULT_ARG)

vault-edit: vault-check ## 🔐 Edit the encrypted host secrets
	@$(ANSIBLE) ansible-vault edit group_vars/all/vault.yml $(VAULT_ARG)

vault-rekey: vault-check ## 🔑 Change the password the vault is locked with
	@$(ANSIBLE) ansible-vault rekey group_vars/all/vault.yml $(VAULT_ARG)
	@printf "$(YEL)⚠  Put the new password in $(VAULT) — the old one no longer opens it$(RST)\n"

##@ Admin panel

admin: check ## 🎛️  Rebuild and restart the admin panel
	@$(COMPOSE) up -d --build --no-deps admin
	@printf "$(GRN)✓ admin panel rebuilt$(RST) — https://$$(grep '^ADMIN_HOST=' .env | cut -d= -f2)\n"

admin-logs: ## 📋 Follow the admin panel log
	@$(COMPOSE) logs -f --tail=100 admin

admin-password: ## 🔑 Show the admin panel password
	@grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-

modpack: ## 🎁 Build the player modpack from the installed mods
	@test -d server/data/mods || { printf "$(RED)✗ no mods installed$(RST) — run $(CYAN)make up$(RST) first\n"; exit 1; }
	@# Emptied, not replaced: compose bind-mounts this directory into the panel,
	@# and rm -rf would leave that container pointing at the deleted one
	@mkdir -p server/modpack
	@find server/modpack -mindepth 1 -delete
	@mkdir -p server/modpack/mods
	@copied=0; skipped=0; \
	 patterns=$$(grep -vE '^\s*(#|$$)' server/server-only-mods.txt | tr 'A-Z' 'a-z'); \
	 for jar in server/data/mods/*.jar; do \
	   name=$$(basename "$$jar"); lower=$$(printf '%s' "$$name" | tr 'A-Z' 'a-z'); keep=1; \
	   for pattern in $$patterns; do \
	     case "$$lower" in *"$$pattern"*) keep=0; break;; esac; \
	   done; \
	   if [ "$$keep" = 1 ]; then cp "$$jar" server/modpack/mods/; copied=$$((copied+1)); \
	   else skipped=$$((skipped+1)); printf "$(DIM)  skip %s$(RST)\n" "$$name"; fi; \
	 done; \
	 printf "$(DIM)  %s client mods, %s server-only skipped$(RST)\n" "$$copied" "$$skipped"
	@$(MAKE) --no-print-directory client-mods
	@cp server/mods.txt server/modpack/mods.txt
	@cp server/client-mods.txt server/modpack/client-mods.txt
	@printf 'Minecraft %s + NeoForge %s\n\nInstall the NeoForge client, then copy the contents\nof the mods folder into .minecraft/mods\n' \
	  "$$(grep '^MC_VERSION=' .env | cut -d= -f2)" \
	  "$$(grep '^NEOFORGE_VERSION=' .env | cut -d= -f2)" > server/modpack/README.txt
	@cd server/modpack && zip -qr modpack.zip mods mods.txt client-mods.txt README.txt
	@printf "$(GRN)✓ modpack built$(RST) → $(CYAN)server/modpack/modpack.zip$(RST) ($$(du -h server/modpack/modpack.zip | cut -f1))\n"
	@printf "  Players download it from the panel's $(CYAN)Mods$(RST) page\n"

client-mods: ## 🧲 Fetch the client-only mods into the pack (part of make modpack)
	@command -v jq >/dev/null || { printf "$(RED)✗ jq is required$(RST) — apt install jq\n"; exit 1; }
	@mkdir -p server/modpack/mods
	@mc=$$(grep '^MC_VERSION=' .env | cut -d= -f2); n=0; \
	 for entry in $$(grep -vE '^\s*(#|$$)' server/client-mods.txt); do \
	   slug=$${entry%%[:=]*}; want=release; pin=; \
	   case "$$entry" in *=*) pin=$${entry#*=}; want=any;; *:*) want=any;; esac; \
	   json=$$(curl -fsS "https://api.modrinth.com/v2/project/$$slug/version?loaders=%5B%22neoforge%22%5D&game_versions=%5B%22$$mc%22%5D") \
	     || { printf "$(RED)✗ %s: Modrinth is unreachable$(RST)\n" "$$slug"; exit 1; }; \
	   line=$$(printf '%s' "$$json" | jq -r --arg want "$$want" --arg pin "$$pin" \
	     '[.[] | select($$pin == "" or .version_number == $$pin) \
	           | select($$want == "any" or .version_type == $$want)] \
	      | first | .files[] | select(.primary) | .url + " " + .filename'); \
	   [ -n "$$line" ] && [ "$$line" != "null" ] \
	     || { printf "$(RED)✗ %s: no neoforge build for MC %s%s$(RST)\n" "$$slug" "$$mc" "$${pin:+ at $$pin}"; exit 1; }; \
	   set -- $$line; \
	   curl -fsS -o "server/modpack/mods/$$2" "$$1" \
	     || { printf "$(RED)✗ %s: download failed$(RST)\n" "$$slug"; exit 1; }; \
	   printf "$(DIM)  + %s$(RST)\n" "$$2"; n=$$((n+1)); \
	 done; \
	 printf "$(DIM)  %s client-only mods fetched from Modrinth$(RST)\n" "$$n"

map: ## 🗺️  BlueMap render status
	@$(COMPOSE) exec -T $(SERVICE) rcon-cli bluemap

# Rendering competes with the tick, so the maps catch up in one window at night.
MAPS := world world_the_nether world_the_end

map-render: ## 🌙 Unfreeze the maps and render (the nightly job)
	@for m in $(MAPS); do $(COMPOSE) exec -T $(SERVICE) rcon-cli bluemap unfreeze $$m >/dev/null; done
	@$(COMPOSE) exec -T $(SERVICE) rcon-cli bluemap update >/dev/null
	@printf "$(GRN)✓ rendering$(RST) — follow with $(CYAN)make map$(RST)\n"

map-pause: ## ⏸️  Freeze the maps until the next render window
	@for m in $(MAPS); do $(COMPOSE) exec -T $(SERVICE) rcon-cli bluemap freeze $$m >/dev/null; done
	@printf "$(GRN)✓ maps frozen$(RST) — they resume at the next $(CYAN)make map-render$(RST)\n"

proxy: check ## 🌐 Start Traefik (TLS termination; needs ports 80/443 free)
	@$(COMPOSE) --profile proxy up -d proxy
	@printf "$(GRN)✓ proxy started$(RST)\n"
