.DEFAULT_GOAL := help
SHELL := /bin/bash
COMPOSE := docker compose
SERVICE := minecraft

# User arguments: make cmd C="say hi" | make pregen R=5000 | make restore F=...
R ?= 3000

# Colour by meaning, not decoration. Long names on purpose — short ones would
# collide with the user arguments above.
#   CYAN  something to type        GRN  it worked
#   YEL   proceed with care        RED  it failed
#   DIM   secondary detail         BOLD structure
BOLD := \033[1m
DIM  := \033[2m
CYAN := \033[36m
GRN  := \033[32m
YEL  := \033[33m
RED  := \033[31m
MAG  := \033[35m
RST  := \033[0m

.PHONY: help check init up down restart logs status stats players tps \
        disk console rcon cmd pregen seed save backup backups restore \
        pull update mods clean-mods config admin admin-logs admin-password map modpack proxy urls provision provision-check release

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
	@sed -i "s|^DOCKER_GID=.*|DOCKER_GID=$$(stat -c '%g' /var/run/docker.sock 2>/dev/null || echo 988)|" .env
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

urls: ## 🔗 Show the configured addresses
	@printf "  $(BOLD)Minecraft$(RST)  $(CYAN)%s$(RST):%s\n" "$$(grep '^SERVER_HOST=' .env | cut -d= -f2)" "$$(grep '^SERVER_PORT=' .env | cut -d= -f2)"
	@printf "  $(BOLD)Admin$(RST)      $(CYAN)https://%s$(RST)\n" "$$(grep '^ADMIN_HOST=' .env | cut -d= -f2)"
	@printf "  $(BOLD)Map$(RST)        $(CYAN)https://%s$(RST)\n" "$$(grep '^MAP_HOST=' .env | cut -d= -f2)"

stats: ## 📊 Live CPU and memory usage
	@docker stats minecraft minecraft-backups minecraft-admin

players: ## 👥 List online players
	@$(COMPOSE) exec -T $(SERVICE) rcon-cli list

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

pregen: ## 🗺️  Pre-generate the world — make pregen R=3000
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
	@printf "$(GRN)✓ restored$(RST)\n"

##@ Maintenance

pull: ## ⬇️  Pull newer base images
	@$(COMPOSE) pull

update: pull ## ⬆️  Pull images and recreate the server
	@$(COMPOSE) up -d
	@printf "$(GRN)✓ updated$(RST) — mods re-resolved from server/mods.txt\n"

mods: ## 🧩 List installed mod jars
	@ls -1 server/data/mods/ 2>/dev/null || printf "$(DIM)not installed yet — run make up$(RST)\n"

clean-mods: ## 🧹 Wipe server/data/mods so the next boot re-downloads
	@$(COMPOSE) down
	@rm -rf server/data/mods
	@printf "$(GRN)✓ server/data/mods removed$(RST) — run $(CYAN)make up$(RST) to re-resolve\n"

config: ## 🔍 Validate and print the resolved compose config
	@$(COMPOSE) config

##@ Provisioning

provision: ## 🏗️  Prepare the server with Ansible
	@cd ansible && ansible-playbook -i inventory.yml site.yml

provision-check: ## 🔍 Dry-run the playbook without changing anything
	@cd ansible && ansible-playbook -i inventory.yml site.yml --check --diff

release: ## 🚀 Pull and restart on the server (what the pipeline runs)
	@cd ansible && ansible-playbook -i inventory.yml site.yml --tags deploy

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
	@rm -rf server/modpack && mkdir -p server/modpack/mods
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
	@cp server/mods.txt server/modpack/mods.txt
	@printf 'Minecraft %s + NeoForge %s\n\nInstall the NeoForge client, then copy the contents\nof the mods folder into .minecraft/mods\n' \
	  "$$(grep '^MC_VERSION=' .env | cut -d= -f2)" \
	  "$$(grep '^NEOFORGE_VERSION=' .env | cut -d= -f2)" > server/modpack/README.txt
	@cd server/modpack && zip -qr modpack.zip mods mods.txt README.txt
	@printf "$(GRN)✓ modpack built$(RST) → $(CYAN)server/modpack/modpack.zip$(RST) ($$(du -h server/modpack/modpack.zip | cut -f1))\n"
	@printf "  Players download it from the panel's $(CYAN)Mods$(RST) page\n"

map: ## 🗺️  BlueMap render status
	@$(COMPOSE) exec -T $(SERVICE) rcon-cli bluemap

proxy: check ## 🌐 Start Traefik (TLS termination; needs ports 80/443 free)
	@$(COMPOSE) --profile proxy up -d proxy
	@printf "$(GRN)✓ proxy started$(RST)\n"
