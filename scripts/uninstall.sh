#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# PyIDE - Uninstall Script
# Version: 1.0.0
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mengvision/pyide/main/scripts/uninstall.sh | bash
#   bash uninstall.sh [--dir DIR] [--remove-data] [--remove-dir] [--yes]
#
# Options:
#   -d, --dir DIR      PyIDE installation directory  (default: ~/pyide)
#   --remove-data      Also delete Docker volumes (database + files)
#   --remove-dir       Also delete the installation directory
#   -y, --yes          Non-interactive: assume yes to all prompts
#   -h, --help         Show this help
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ───────────────────────────────────────────────────────────
# Color codes
# ───────────────────────────────────────────────────────────
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' NC=''
fi

# ───────────────────────────────────────────────────────────
# Logging helpers
# ───────────────────────────────────────────────────────────
info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[⚠]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*" >&2; }
step()  { echo -e "\n${BLUE}${BOLD}──▶${NC} $*"; }
die()   { error "$*"; exit 1; }

# ───────────────────────────────────────────────────────────
# Defaults
# ───────────────────────────────────────────────────────────
INSTALL_DIR="${PYIDE_DIR:-$HOME/pyide}"
COMPOSE_FILE="docker-compose.lan.yml"
REMOVE_DATA=false
REMOVE_DIR=false
AUTO_YES=false
PIPE_MODE=false
[ ! -t 0 ] && PIPE_MODE=true

# ───────────────────────────────────────────────────────────
# Banner
# ───────────────────────────────────────────────────────────
print_banner() {
  echo -e "${RED}"
  echo '  ██████╗ ██╗   ██╗    ██╗██████╗ ███████╗'
  echo '  ██╔══██╗╚██╗ ██╔╝    ██║██╔══██╗██╔════╝'
  echo '  ██████╔╝ ╚████╔╝     ██║██║  ██║█████╗  '
  echo '  ██╔═══╝   ╚██╔╝      ██║██║  ██║██╔══╝  '
  echo '  ██║        ██║       ██║██████╔╝███████╗ '
  echo '  ╚═╝        ╚═╝       ╚═╝╚═════╝ ╚══════╝'
  echo -e "${NC}"
  echo -e "${BOLD}  PyIDE Uninstaller${NC}"
  echo ""
}

# ───────────────────────────────────────────────────────────
# Help
# ───────────────────────────────────────────────────────────
print_help() {
  echo "Usage: uninstall.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -d, --dir DIR    Installation directory (default: ~/pyide)"
  echo "  --remove-data    Delete Docker volumes (WARNING: removes all data)"
  echo "  --remove-dir     Delete the installation directory"
  echo "  -y, --yes        Non-interactive, assume yes to all prompts"
  echo "  -h, --help       Show this help"
  echo ""
  echo "Examples:"
  echo "  # Stop containers only (keep data)"
  echo "  bash uninstall.sh"
  echo ""
  echo "  # Full removal including data and source"
  echo "  bash uninstall.sh --remove-data --remove-dir --yes"
}

# ───────────────────────────────────────────────────────────
# Argument parsing
# ───────────────────────────────────────────────────────────
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -d|--dir)       INSTALL_DIR="$2"; shift 2 ;;
      --remove-data)  REMOVE_DATA=true; shift ;;
      --remove-dir)   REMOVE_DIR=true; shift ;;
      -y|--yes)       AUTO_YES=true; shift ;;
      -h|--help)      print_help; exit 0 ;;
      *)              die "Unknown option: $1. Run with --help for usage." ;;
    esac
  done
}

# ───────────────────────────────────────────────────────────
# Prompt for yes/no confirmation
# Returns 0 (true) if user confirms, 1 (false) otherwise
# ───────────────────────────────────────────────────────────
confirm() {
  local prompt="$1"
  local default="${2:-n}"

  if [ "$AUTO_YES" = true ] || [ "$PIPE_MODE" = true ]; then
    echo -e "    ${CYAN}${prompt} [auto: ${default}]${NC}"
    [[ "$default" == "y" ]] && return 0 || return 1
  fi

  local yn_hint="[y/N]"
  [[ "$default" == "y" ]] && yn_hint="[Y/n]"

  read -r -p "  $(echo -e "${YELLOW}?${NC}") ${prompt} ${yn_hint}: " _reply
  _reply="${_reply:-$default}"
  [[ "$_reply" =~ ^[Yy]$ ]]
}

# ───────────────────────────────────────────────────────────
# Verify Docker is available (soft check — not fatal)
# ───────────────────────────────────────────────────────────
check_docker() {
  if ! command -v docker &>/dev/null; then
    warn "Docker not found. Skipping container operations."
    return 1
  fi
  if ! docker info &>/dev/null 2>&1; then
    warn "Docker daemon not running. Skipping container operations."
    return 1
  fi
  return 0
}

# ───────────────────────────────────────────────────────────
# Stop and remove containers
# ───────────────────────────────────────────────────────────
stop_containers() {
  step "Stopping PyIDE containers..."

  if ! check_docker; then
    warn "Skipped (Docker unavailable)"
    return 0
  fi

  local compose_path="${INSTALL_DIR}/${COMPOSE_FILE}"

  if [ ! -f "$compose_path" ]; then
    warn "Compose file not found at ${compose_path}."
    warn "Attempting to stop containers by name prefix..."
    # Fallback: stop any containers with pyide in the name
    local containers
    containers=$(docker ps -a --filter "name=pyide" --format "{{.ID}}" 2>/dev/null || true)
    if [ -n "$containers" ]; then
      echo "$containers" | xargs docker rm -f 2>/dev/null || true
      info "Removed containers matching 'pyide' name filter"
    else
      warn "No matching containers found"
    fi
    return 0
  fi

  cd "$INSTALL_DIR"

  if [ "$REMOVE_DATA" = true ]; then
    info "Stopping containers and removing volumes..."
    docker compose -f "$COMPOSE_FILE" down -v 2>&1 || true
    info "Containers and volumes removed"
  else
    info "Stopping containers (volumes preserved)..."
    docker compose -f "$COMPOSE_FILE" down 2>&1 || true
    info "Containers stopped"
  fi
}

# ───────────────────────────────────────────────────────────
# Remove Docker volumes explicitly (if --remove-data)
# ───────────────────────────────────────────────────────────
remove_volumes() {
  if [ "$REMOVE_DATA" != true ]; then
    return 0
  fi

  step "Removing Docker volumes..."

  if ! check_docker; then
    warn "Skipped (Docker unavailable)"
    return 0
  fi

  local dir_basename
  dir_basename=$(basename "$INSTALL_DIR")

  for vol in "${dir_basename}_postgres_data" "${dir_basename}_pyide_data" \
             "pyide_postgres_data" "pyide_pyide_data"; do
    if docker volume inspect "$vol" &>/dev/null 2>&1; then
      docker volume rm "$vol" 2>/dev/null && info "Removed volume: ${vol}" || \
        warn "Could not remove volume: ${vol} (may still be in use)"
    fi
  done
}

# ───────────────────────────────────────────────────────────
# Remove installation directory
# ───────────────────────────────────────────────────────────
remove_directory() {
  if [ "$REMOVE_DIR" != true ]; then
    return 0
  fi

  step "Removing installation directory: ${INSTALL_DIR}"

  if [ ! -d "$INSTALL_DIR" ]; then
    warn "Directory not found: ${INSTALL_DIR}"
    return 0
  fi

  # Safety: refuse to remove root or home
  if [[ "$INSTALL_DIR" == "/" || "$INSTALL_DIR" == "$HOME" ]]; then
    warn "Refusing to remove root or home directory: ${INSTALL_DIR}"
    return 1
  fi

  rm -rf "$INSTALL_DIR"
  info "Removed directory: ${INSTALL_DIR}"
}

# ───────────────────────────────────────────────────────────
# Print post-uninstall summary
# ───────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${BOLD}  Uninstall Summary:${NC}"

  if [ "$REMOVE_DATA" = true ]; then
    echo -e "    ${GREEN}✓${NC} Containers and data volumes removed"
  else
    echo -e "    ${GREEN}✓${NC} Containers stopped (volumes retained)"
    echo -e "    ${CYAN}    Volumes still exist. To remove later:${NC}"
    echo -e "    ${CYAN}    docker volume rm pyide_postgres_data pyide_pyide_data${NC}"
  fi

  if [ "$REMOVE_DIR" = true ]; then
    echo -e "    ${GREEN}✓${NC} Installation directory removed"
  else
    echo -e "    ${CYAN}ℹ${NC}  Installation directory kept at: ${INSTALL_DIR}"
  fi

  echo ""
  echo -e "  Thank you for using ${BOLD}PyIDE${NC}!"
  echo ""
}

# ───────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────
main() {
  print_banner
  parse_args "$@"

  echo -e "${BOLD}  Installation directory: ${CYAN}${INSTALL_DIR}${NC}"
  echo ""

  # Determine scope of uninstall and confirm
  if [ "$AUTO_YES" != true ] && [ "$PIPE_MODE" != true ]; then
    echo -e "${YELLOW}  What to remove:${NC}"
    echo -e "    - Docker containers: always"
    echo -e "    - Docker volumes (data): $([ "$REMOVE_DATA" = true ] && echo 'YES ⚠' || echo 'no')"
    echo -e "    - Installation directory: $([ "$REMOVE_DIR" = true ] && echo 'YES' || echo 'no')"
    echo ""

    if [ "$REMOVE_DATA" = false ]; then
      if confirm "Also delete all data volumes (database, files)? WARNING: IRREVERSIBLE" "n"; then
        REMOVE_DATA=true
      fi
    fi

    if [ "$REMOVE_DIR" = false ]; then
      if confirm "Also delete the installation directory (${INSTALL_DIR})?" "n"; then
        REMOVE_DIR=true
      fi
    fi

    echo ""
    confirm "Proceed with uninstall?" "y" || { echo "Uninstall cancelled."; exit 0; }
  fi

  stop_containers
  remove_volumes
  remove_directory
  print_summary
}

main "$@"
