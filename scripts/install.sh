#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# PyIDE - One-Line Installation Script
# Version: 1.0.0
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mengvision/pyide/main/scripts/install.sh | bash
#
#   # With options passed via bash -s --:
#   curl -fsSL ... | bash -s -- --api-port 9000 --ip 192.168.1.100
#
#   # With environment variables (works even in pipe mode):
#   PYIDE_API_PORT=9000 PYIDE_IP=192.168.1.100 curl -fsSL ... | bash
#
# Options:
#   -d, --dir DIR        Installation directory  (default: ~/pyide)
#   -p, --api-port PORT  API service port        (default: 8001)
#   -w, --web-port PORT  Web service port        (default: 3000)
#   -i, --ip IP          Server IP address       (default: auto-detect)
#   --non-interactive    Non-interactive mode, use all defaults
#   -h, --help           Show this help message
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ───────────────────────────────────────────────────────────
# Constants
# ───────────────────────────────────────────────────────────
readonly PYIDE_VERSION="1.0.0"
readonly REPO_URL="https://github.com/mengvision/pyide.git"
readonly COMPOSE_FILE="docker-compose.lan.yml"
readonly LOG_FILE="install.log"
readonly HEALTH_RETRY=30
readonly HEALTH_INTERVAL=3

# ───────────────────────────────────────────────────────────
# Color codes (disabled automatically for non-TTY)
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

# Internal: write to both stdout and log file
_log_raw() {
  local level="$1"; shift
  local msg="$*"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  # Strip ANSI codes for log file
  local plain_msg
  plain_msg=$(printf '%s' "$msg" | sed 's/\x1b\[[0-9;]*m//g')
  echo "[$timestamp] [$level] $plain_msg" >> "${INSTALL_DIR:-/tmp}/${LOG_FILE}" 2>/dev/null || true
}

info()    { echo -e "${GREEN}[✓]${NC} $*"; _log_raw "INFO" "$*"; }
warn()    { echo -e "${YELLOW}[⚠]${NC} $*"; _log_raw "WARN" "$*"; }
error()   { echo -e "${RED}[✗]${NC} $*" >&2; _log_raw "ERROR" "$*"; }
step()    { echo -e "\n${BLUE}${BOLD}──▶${NC} $*"; _log_raw "STEP" "$*"; }
detail()  { echo -e "    ${CYAN}$*${NC}"; _log_raw "INFO" "$*"; }

# Print and exit with non-zero status
die() {
  error "$*"
  echo ""
  error "Installation failed. Check ${LOG_FILE} for details."
  exit 1
}

# ───────────────────────────────────────────────────────────
# Default configuration values
# Environment variable overrides (PYIDE_ prefix) take effect
# before argument parsing so they work in pipe mode.
# ───────────────────────────────────────────────────────────
INSTALL_DIR="${PYIDE_DIR:-$HOME/pyide}"
API_PORT="${PYIDE_API_PORT:-8001}"
WEB_PORT="${PYIDE_WEB_PORT:-3000}"
SERVER_IP="${PYIDE_IP:-}"
NON_INTERACTIVE=false

# Detect pipe mode: stdin is not a terminal
PIPE_MODE=false
[ ! -t 0 ] && PIPE_MODE=true

# ───────────────────────────────────────────────────────────
# Banner
# ───────────────────────────────────────────────────────────
print_banner() {
  echo -e "${BLUE}"
  echo '  ██████╗ ██╗   ██╗    ██╗██████╗ ███████╗'
  echo '  ██╔══██╗╚██╗ ██╔╝    ██║██╔══██╗██╔════╝'
  echo '  ██████╔╝ ╚████╔╝     ██║██║  ██║█████╗  '
  echo '  ██╔═══╝   ╚██╔╝      ██║██║  ██║██╔══╝  '
  echo '  ██║        ██║       ██║██████╔╝███████╗ '
  echo '  ╚═╝        ╚═╝       ╚═╝╚═════╝ ╚══════╝'
  echo -e "${NC}"
  echo -e "${BOLD}  PyIDE v${PYIDE_VERSION} — One-Line Installer${NC}"
  echo -e "  ${CYAN}https://github.com/mengvision/pyide${NC}"
  echo ""
}

# ───────────────────────────────────────────────────────────
# Help
# ───────────────────────────────────────────────────────────
print_help() {
  echo "Usage: install.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -d, --dir DIR        Installation directory  (default: ~/pyide)"
  echo "  -p, --api-port PORT  API service port        (default: 8001)"
  echo "  -w, --web-port PORT  Web service port        (default: 3000)"
  echo "  -i, --ip IP          Server IP address       (default: auto-detect)"
  echo "  --non-interactive    Use all defaults, no prompts"
  echo "  -h, --help           Show this help"
  echo ""
  echo "Environment variables (PYIDE_ prefix):"
  echo "  PYIDE_DIR            Same as --dir"
  echo "  PYIDE_API_PORT       Same as --api-port"
  echo "  PYIDE_WEB_PORT       Same as --web-port"
  echo "  PYIDE_IP             Same as --ip"
  echo ""
  echo "Examples:"
  echo "  # Basic install"
  echo "  curl -fsSL https://raw.githubusercontent.com/mengvision/pyide/main/scripts/install.sh | bash"
  echo ""
  echo "  # Custom ports via env vars (pipe-safe)"
  echo "  PYIDE_API_PORT=9000 PYIDE_WEB_PORT=8080 curl -fsSL ... | bash"
  echo ""
  echo "  # Custom ports via arguments"
  echo "  curl -fsSL ... | bash -s -- --api-port 9000 --web-port 8080"
}

# ───────────────────────────────────────────────────────────
# Argument parsing
# ───────────────────────────────────────────────────────────
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -d|--dir)
        INSTALL_DIR="$2"; shift 2 ;;
      -p|--api-port)
        API_PORT="$2"; shift 2 ;;
      -w|--web-port)
        WEB_PORT="$2"; shift 2 ;;
      -i|--ip)
        SERVER_IP="$2"; shift 2 ;;
      --non-interactive)
        NON_INTERACTIVE=true; shift ;;
      -h|--help)
        print_help; exit 0 ;;
      *)
        die "Unknown option: $1. Run with --help for usage." ;;
    esac
  done

  # Validate port numbers
  for _port_var in API_PORT WEB_PORT; do
    _port_val="${!_port_var}"
    if ! [[ "$_port_val" =~ ^[0-9]+$ ]] || (( _port_val < 1 || _port_val > 65535 )); then
      die "Invalid port for ${_port_var}: ${_port_val} (must be 1-65535)"
    fi
  done
}

# ───────────────────────────────────────────────────────────
# Prerequisite checks
# ───────────────────────────────────────────────────────────
check_prerequisites() {
  step "Checking prerequisites..."

  # Docker
  if ! command -v docker &>/dev/null; then
    error "Docker is not installed."
    detail "Install Docker: curl -fsSL https://get.docker.com | sh"
    detail "Then add your user: sudo usermod -aG docker \$USER"
    die "Missing required dependency: docker"
  fi
  info "Docker: $(docker --version | head -1)"

  # Docker Compose (v2 plugin or standalone v1)
  if docker compose version &>/dev/null 2>&1; then
    info "Docker Compose: $(docker compose version | head -1)"
  elif command -v docker-compose &>/dev/null; then
    # Alias v1 to v2 syntax for rest of script
    warn "Docker Compose v1 detected. Proceeding with compatibility mode."
    docker() {
      if [[ "$1" == "compose" ]]; then
        shift; command docker-compose "$@"
      else
        command docker "$@"
      fi
    }
    export -f docker
  else
    error "Docker Compose is not available."
    detail "Install: sudo apt-get install docker-compose-plugin"
    die "Missing required dependency: docker compose"
  fi

  # git
  if ! command -v git &>/dev/null; then
    error "git is not installed."
    detail "Install: sudo apt-get install git  (Debian/Ubuntu)"
    detail "         sudo yum install git       (RHEL/CentOS)"
    die "Missing required dependency: git"
  fi
  info "git: $(git --version)"

  # openssl (optional but recommended for key generation)
  if command -v openssl &>/dev/null; then
    info "openssl: $(openssl version)"
  else
    warn "openssl not found; will use /dev/urandom fallback for key generation."
  fi

  # Check Docker daemon is running
  if ! docker info &>/dev/null 2>&1; then
    error "Docker daemon is not running."
    detail "Start it with: sudo systemctl start docker"
    die "Docker daemon unavailable"
  fi
}

# ───────────────────────────────────────────────────────────
# IP detection
# ───────────────────────────────────────────────────────────
detect_server_ip() {
  # Try multiple methods in order of reliability
  local detected=""

  # hostname -I (Linux)
  if command -v hostname &>/dev/null; then
    detected=$(hostname -I 2>/dev/null | awk '{print $1}' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true)
  fi

  # ip route (Linux)
  if [ -z "$detected" ] && command -v ip &>/dev/null; then
    detected=$(ip route get 8.8.8.8 2>/dev/null | awk '/src/{print $7}' | head -1 || true)
  fi

  # ifconfig fallback (macOS / older Linux)
  if [ -z "$detected" ] && command -v ifconfig &>/dev/null; then
    detected=$(ifconfig 2>/dev/null \
      | grep -E 'inet [0-9]' \
      | grep -v '127.0.0.1' \
      | awk '{print $2}' \
      | head -1 || true)
  fi

  echo "${detected:-127.0.0.1}"
}

# ───────────────────────────────────────────────────────────
# Port conflict check
# ───────────────────────────────────────────────────────────
check_port() {
  local port="$1"
  local service="$2"

  if command -v ss &>/dev/null; then
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
      return 1
    fi
  elif command -v netstat &>/dev/null; then
    if netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
      return 1
    fi
  fi
  # If neither tool available, skip check
  return 0
}

check_port_conflicts() {
  step "Checking port availability..."
  local conflict=false

  if ! check_port "$API_PORT" "API"; then
    warn "Port ${API_PORT} is already in use (API)."
    warn "Use --api-port to specify a different port."
    conflict=true
  else
    info "Port ${API_PORT} is available (API)"
  fi

  if ! check_port "$WEB_PORT" "Web"; then
    warn "Port ${WEB_PORT} is already in use (Web)."
    warn "Use --web-port to specify a different port."
    conflict=true
  else
    info "Port ${WEB_PORT} is available (Web)"
  fi

  if [ "$conflict" = true ]; then
    die "Port conflict detected. Please choose different ports and re-run."
  fi
}

# ───────────────────────────────────────────────────────────
# Interactive configuration (skipped in pipe/non-interactive mode)
# ───────────────────────────────────────────────────────────
interactive_config() {
  if [ "$PIPE_MODE" = true ] || [ "$NON_INTERACTIVE" = true ]; then
    return 0
  fi

  step "Interactive configuration (press Enter to accept defaults)..."
  echo ""

  # Install directory
  read -r -p "  Installation directory [${INSTALL_DIR}]: " _input
  [ -n "$_input" ] && INSTALL_DIR="$_input"

  # API port
  read -r -p "  API port [${API_PORT}]: " _input
  [ -n "$_input" ] && API_PORT="$_input"

  # Web port
  read -r -p "  Web port [${WEB_PORT}]: " _input
  [ -n "$_input" ] && WEB_PORT="$_input"

  # Server IP
  read -r -p "  Server IP [${SERVER_IP}]: " _input
  [ -n "$_input" ] && SERVER_IP="$_input"

  echo ""
}

# ───────────────────────────────────────────────────────────
# Generate a random hex secret
# ───────────────────────────────────────────────────────────
gen_secret() {
  local bytes="${1:-32}"
  if command -v openssl &>/dev/null; then
    openssl rand -hex "$bytes"
  else
    # Fallback: /dev/urandom + xxd
    head -c "$bytes" /dev/urandom | xxd -p | tr -d '\n'
  fi
}

# ───────────────────────────────────────────────────────────
# Clone or update the repository
# ───────────────────────────────────────────────────────────
setup_repository() {
  step "Setting up repository in ${INSTALL_DIR}..."

  if [ -d "${INSTALL_DIR}/.git" ]; then
    # Idempotent: update existing clone
    info "Repository already exists, updating..."
    git -C "$INSTALL_DIR" fetch --depth=1 origin main 2>&1 | tee -a "${INSTALL_DIR}/${LOG_FILE}" || true
    git -C "$INSTALL_DIR" reset --hard origin/main 2>&1 | tee -a "${INSTALL_DIR}/${LOG_FILE}"
  else
    # Fresh clone (shallow for speed)
    info "Cloning PyIDE repository (shallow)..."
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" 2>&1 | tee -a "/tmp/${LOG_FILE}"
    # Move temp log into install dir
    cat "/tmp/${LOG_FILE}" >> "${INSTALL_DIR}/${LOG_FILE}" 2>/dev/null || true
  fi

  info "Repository ready at ${INSTALL_DIR}"
}

# ───────────────────────────────────────────────────────────
# Generate .env file from template
# ───────────────────────────────────────────────────────────
generate_env() {
  step "Generating environment configuration..."

  local env_file="${INSTALL_DIR}/.env"
  local env_example="${INSTALL_DIR}/.env.lan.example"

  if [ ! -f "$env_example" ]; then
    die "Template file not found: ${env_example}"
  fi

  if [ -f "$env_file" ]; then
    # Idempotent: back up existing .env but do NOT overwrite secrets
    info ".env already exists, skipping generation (secrets preserved)."
    info "Delete ${env_file} and re-run to regenerate."
    return 0
  fi

  local secret_key db_password
  secret_key=$(gen_secret 32)
  db_password=$(gen_secret 16)

  cp "$env_example" "$env_file"

  # Replace placeholders using a portable sed approach
  sed -i.bak \
    -e "s|SECRET_KEY=.*|SECRET_KEY=${secret_key}|" \
    -e "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${db_password}|" \
    -e "s|API_PORT=.*|API_PORT=${API_PORT}|" \
    -e "s|SERVER_URL=.*|SERVER_URL=http://${SERVER_IP}:${API_PORT}|" \
    "$env_file"

  rm -f "${env_file}.bak"

  info "Generated .env with randomized secrets"
  detail "SECRET_KEY: ${secret_key:0:8}... (truncated)"
  detail "DB password: ${db_password:0:4}... (truncated)"
}

# ───────────────────────────────────────────────────────────
# Patch docker-compose ports to respect CLI/env overrides
# ───────────────────────────────────────────────────────────
patch_compose_ports() {
  step "Patching compose port mappings..."

  local compose_file="${INSTALL_DIR}/${COMPOSE_FILE}"
  if [ ! -f "$compose_file" ]; then
    die "Compose file not found: ${compose_file}"
  fi

  # Use sed to replace the hard-coded port mappings (idempotent friendly)
  sed -i.bak \
    -e "s|\"8001:8001\"|\"${API_PORT}:${API_PORT}\"|g" \
    -e "s|'8001:8001'|'${API_PORT}:${API_PORT}'|g" \
    -e "s|- 8001:8001|- ${API_PORT}:${API_PORT}|g" \
    -e "s|\"3000:3000\"|\"${WEB_PORT}:${WEB_PORT}\"|g" \
    -e "s|'3000:3000'|'${WEB_PORT}:${WEB_PORT}'|g" \
    -e "s|- 3000:3000|- ${WEB_PORT}:${WEB_PORT}|g" \
    "$compose_file"

  rm -f "${compose_file}.bak"
  info "Compose ports patched: API=${API_PORT}, Web=${WEB_PORT}"
}

# ───────────────────────────────────────────────────────────
# Build and start Docker services
# ───────────────────────────────────────────────────────────
start_services() {
  step "Building and starting services (this may take a few minutes)..."

  cd "$INSTALL_DIR"

  # Pull latest base images to reduce build time
  info "Pulling base images..."
  docker compose -f "$COMPOSE_FILE" pull --ignore-pull-failures 2>&1 \
    | tee -a "${LOG_FILE}" || true

  info "Building and starting containers..."
  docker compose -f "$COMPOSE_FILE" up -d --build 2>&1 \
    | tee -a "${LOG_FILE}"

  info "Services started"
}

# ───────────────────────────────────────────────────────────
# Health check: wait until API is responsive
# ───────────────────────────────────────────────────────────
wait_for_services() {
  step "Waiting for services to become healthy..."

  local api_url="http://127.0.0.1:${API_PORT}/health"
  local attempt=0

  while (( attempt < HEALTH_RETRY )); do
    if curl -sf --max-time 3 "$api_url" &>/dev/null; then
      info "API is healthy at ${api_url}"
      return 0
    fi
    attempt=$(( attempt + 1 ))
    echo -ne "    ${CYAN}Waiting... (${attempt}/${HEALTH_RETRY})${NC}\r"
    sleep "$HEALTH_INTERVAL"
  done

  echo ""
  warn "API health check timed out after $(( HEALTH_RETRY * HEALTH_INTERVAL ))s."
  warn "Services may still be starting. Check: docker compose -f ${COMPOSE_FILE} logs -f"
  # Non-fatal: continue to print access info
}

# ───────────────────────────────────────────────────────────
# Create default admin account via API
# ───────────────────────────────────────────────────────────
create_admin_account() {
  step "Creating default admin account..."

  local api_url="http://127.0.0.1:${API_PORT}"
  local admin_user="admin"
  local admin_pass
  admin_pass=$(gen_secret 8)
  local admin_email="admin@pyide.local"

  # Save credentials to a local file for user reference
  local cred_file="${INSTALL_DIR}/admin-credentials.txt"

  # Attempt registration via REST API
  local http_code
  http_code=$(curl -sf \
    -o /dev/null \
    -w "%{http_code}" \
    --max-time 10 \
    -X POST "${api_url}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${admin_user}\",\"email\":\"${admin_email}\",\"password\":\"${admin_pass}\"}" \
    2>/dev/null || echo "000")

  if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
    info "Admin account created successfully"
    # Save credentials
    {
      echo "# PyIDE Admin Credentials"
      echo "# Generated: $(date)"
      echo "Username: ${admin_user}"
      echo "Password: ${admin_pass}"
      echo "Email:    ${admin_email}"
      echo "Web URL:  http://${SERVER_IP}:${WEB_PORT}"
    } > "$cred_file"
    chmod 600 "$cred_file"
    info "Credentials saved to: ${cred_file}"
    # Export for summary
    ADMIN_USER="$admin_user"
    ADMIN_PASS="$admin_pass"
  elif [[ "$http_code" == "400" || "$http_code" == "409" ]]; then
    warn "Admin account already exists (HTTP ${http_code}), skipping."
    ADMIN_USER="admin"
    ADMIN_PASS="(existing account)"
  else
    warn "Could not create admin account (HTTP ${http_code})."
    warn "Register manually at http://${SERVER_IP}:${WEB_PORT}"
    ADMIN_USER=""
    ADMIN_PASS=""
  fi
}

# ───────────────────────────────────────────────────────────
# Print final summary
# ───────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║           🎉  PyIDE Installation Complete!               ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BOLD}  Access URLs:${NC}"
  echo -e "    ${CYAN}Web IDE:   ${YELLOW}http://${SERVER_IP}:${WEB_PORT}${NC}"
  echo -e "    ${CYAN}API:       ${YELLOW}http://${SERVER_IP}:${API_PORT}${NC}"
  echo -e "    ${CYAN}API Docs:  ${YELLOW}http://${SERVER_IP}:${API_PORT}/docs${NC}"
  echo ""

  if [ -n "${ADMIN_USER:-}" ]; then
    echo -e "${BOLD}  Admin Credentials:${NC}"
    echo -e "    ${CYAN}Username: ${YELLOW}${ADMIN_USER}${NC}"
    echo -e "    ${CYAN}Password: ${YELLOW}${ADMIN_PASS}${NC}"
    echo ""
  fi

  echo -e "${BOLD}  Installation directory:${NC}"
  echo -e "    ${CYAN}${INSTALL_DIR}${NC}"
  echo ""
  echo -e "${BOLD}  Useful commands:${NC}"
  echo -e "    ${CYAN}# View logs${NC}"
  echo -e "    cd ${INSTALL_DIR} && docker compose -f ${COMPOSE_FILE} logs -f"
  echo ""
  echo -e "    ${CYAN}# Stop services${NC}"
  echo -e "    cd ${INSTALL_DIR} && docker compose -f ${COMPOSE_FILE} down"
  echo ""
  echo -e "    ${CYAN}# Restart services${NC}"
  echo -e "    cd ${INSTALL_DIR} && docker compose -f ${COMPOSE_FILE} restart"
  echo ""
  echo -e "    ${CYAN}# Uninstall${NC}"
  echo -e "    curl -fsSL https://raw.githubusercontent.com/mengvision/pyide/main/scripts/uninstall.sh | bash"
  echo ""
  echo -e "${YELLOW}  Tip: Keep credentials file at ${INSTALL_DIR}/admin-credentials.txt${NC}"
  echo ""
}

# ───────────────────────────────────────────────────────────
# Cleanup trap on unexpected errors
# ───────────────────────────────────────────────────────────
on_error() {
  local exit_code=$?
  local line_no=${BASH_LINENO[0]}
  echo ""
  error "Script failed at line ${line_no} with exit code ${exit_code}."
  error "Review the log for details: ${INSTALL_DIR:-/tmp}/${LOG_FILE}"
  exit "$exit_code"
}
trap on_error ERR

# ───────────────────────────────────────────────────────────
# Main entry point
# ───────────────────────────────────────────────────────────
main() {
  print_banner

  # Pipe-mode notice
  if [ "$PIPE_MODE" = true ]; then
    warn "Running in pipe mode — interactive prompts disabled."
    warn "Use PYIDE_* env vars or 'bash -s --' arguments to customize."
    echo ""
  fi

  # Parse CLI arguments (may override env-var defaults)
  parse_args "$@"

  # Auto-detect IP if not provided
  if [ -z "$SERVER_IP" ]; then
    SERVER_IP=$(detect_server_ip)
    info "Auto-detected server IP: ${SERVER_IP}"
  fi

  # Interactive config (no-op in pipe mode)
  interactive_config

  # Print resolved configuration
  step "Configuration summary"
  detail "Install dir : ${INSTALL_DIR}"
  detail "API port    : ${API_PORT}"
  detail "Web port    : ${WEB_PORT}"
  detail "Server IP   : ${SERVER_IP}"
  echo ""

  # Initialize log in temp location until INSTALL_DIR exists
  mkdir -p /tmp
  echo "PyIDE Install Log — $(date)" > "/tmp/${LOG_FILE}"

  # Run installation steps
  check_prerequisites
  setup_repository

  # From here the install dir exists; redirect log
  mv "/tmp/${LOG_FILE}" "${INSTALL_DIR}/${LOG_FILE}" 2>/dev/null || true

  check_port_conflicts
  generate_env
  patch_compose_ports
  start_services
  wait_for_services
  create_admin_account
  print_summary
}

main "$@"
