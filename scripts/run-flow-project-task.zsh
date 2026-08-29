#!/bin/zsh
set -euo pipefail

food_ad_script_dir=${0:A:h}
food_ad_script_name=$0
food_ad_user_home=${HOME:-}
food_ad_suite_root=${FOOD_AD_FLOW_SUITE_ROOT:-}
food_ad_container=${FOOD_AD_FLOW_CONTAINER:-gemini-flow-suite}
food_ad_chrome=${FOOD_AD_FLOW_CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
food_ad_profile=${FOOD_AD_FLOW_PROFILE:-}
food_ad_cdp_port=${FOOD_AD_FLOW_CDP_PORT:-9323}
food_ad_bridge_port=${FOOD_AD_FLOW_BRIDGE_PORT:-19323}
food_ad_bridge_script="$food_ad_suite_root/scripts/cdp_bridge.py"

usage() {
  print "Usage:"
  print "  $food_ad_script_name submit PROJECT_ID /absolute/path/prompt.txt"
  print "  $food_ad_script_name recover PROJECT_ID /absolute/path/output-directory"
}

if [[ ${1:-} == "--help" || ${1:-} == "-h" ]]; then
  usage
  exit 0
fi
if [[ $# -ne 3 ]]; then
  usage >&2
  exit 2
fi
if [[ -z "$food_ad_suite_root" ]]; then
  print -u2 "Set FOOD_AD_FLOW_SUITE_ROOT to the local hbg-gemini-flow-suite directory"
  exit 2
fi
if [[ -z "$food_ad_profile" ]]; then
  if [[ -z "$food_ad_user_home" ]]; then
    print -u2 "Set HOME or FOOD_AD_FLOW_PROFILE"
    exit 2
  fi
  food_ad_profile="$food_ad_user_home/.gemini-flow-suite/flow-chrome"
fi

food_ad_mode=$1
food_ad_project_id=$2
food_ad_target=$3
if [[ ! "$food_ad_project_id" =~ '^[0-9a-fA-F-]{36}$' ]]; then
  print -u2 "Invalid Flow project ID"
  exit 2
fi
if [[ ! -x "$food_ad_chrome" ]]; then
  print -u2 "Google Chrome executable is unavailable"
  exit 1
fi
if [[ ! -f "$food_ad_bridge_script" ]]; then
  print -u2 "Missing Flow bridge: $food_ad_bridge_script"
  exit 1
fi

case "$food_ad_mode" in
  submit)
    if [[ ! -f "$food_ad_target" ]]; then
      print -u2 "Missing prompt file: $food_ad_target"
      exit 1
    fi
    food_ad_helper="$food_ad_script_dir/submit-flow-project.py"
    ;;
  recover)
    case "$food_ad_target" in
      /|${food_ad_user_home}|${food_ad_user_home}/)
        print -u2 "Refusing broad recovery destination"
        exit 2
        ;;
    esac
    mkdir -p "$food_ad_target"
    food_ad_target=${food_ad_target:A}
    food_ad_helper="$food_ad_script_dir/recover-flow-project.py"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

mkdir -p "$food_ad_profile"
"$food_ad_chrome" \
  "--remote-debugging-port=$food_ad_cdp_port" \
  "--remote-debugging-address=127.0.0.1" \
  "--remote-allow-origins=*" \
  "--user-data-dir=$food_ad_profile" \
  "--window-size=1920,1080" \
  "--password-store=basic" \
  "--no-first-run" \
  "--no-default-browser-check" \
  "--headless=new" \
  "https://labs.google/fx/tools/flow?hl=en" \
  >/tmp/food-ad-flow-chrome.log 2>&1 &
food_ad_chrome_pid=$!

python3 "$food_ad_bridge_script" \
  --listen-port "$food_ad_bridge_port" \
  --target-port "$food_ad_cdp_port" \
  >/tmp/food-ad-flow-bridge.log 2>&1 &
food_ad_bridge_pid=$!

cleanup_food_ad_flow() {
  kill "$food_ad_bridge_pid" 2>/dev/null || true
  kill "$food_ad_chrome_pid" 2>/dev/null || true
}
trap cleanup_food_ad_flow EXIT INT TERM

for _food_ad_attempt in {1..60}; do
  if curl -fsS "http://127.0.0.1:$food_ad_cdp_port/json/version" >/dev/null 2>&1 \
    && curl -fsS "http://127.0.0.1:$food_ad_bridge_port/json/version" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

food_ad_browser_path=$(curl -fsS "http://127.0.0.1:$food_ad_cdp_port/json/version" \
  | sed -n 's#.*"webSocketDebuggerUrl": "ws://[^/]*\(/devtools/browser/[^"]*\)".*#\1#p')
if [[ -z "$food_ad_browser_path" ]]; then
  print -u2 "Flow recovery bridge did not become ready"
  exit 1
fi

food_ad_task_tag="food-ad-flow-${$}-$(date +%s)"
food_ad_container_dir="/tmp/$food_ad_task_tag"
docker exec "$food_ad_container" mkdir -p "$food_ad_container_dir"
docker cp "$food_ad_helper" "$food_ad_container:$food_ad_container_dir/helper.py" >/dev/null

if [[ "$food_ad_mode" == "submit" ]]; then
  docker cp "$food_ad_target" "$food_ad_container:$food_ad_container_dir/prompt.txt" >/dev/null
  docker exec \
    -e "GFLOW_CLI_CDP_ENDPOINT=ws://host.docker.internal:$food_ad_bridge_port$food_ad_browser_path" \
    "$food_ad_container" \
    /opt/gflow-venv/bin/python \
    "$food_ad_container_dir/helper.py" \
    "$food_ad_project_id" \
    "$food_ad_container_dir/prompt.txt"
else
  food_ad_container_output="$food_ad_container_dir/output"
  docker exec "$food_ad_container" mkdir -p "$food_ad_container_output"
  set +e
  docker exec \
    -e "GFLOW_CLI_CDP_ENDPOINT=ws://host.docker.internal:$food_ad_bridge_port$food_ad_browser_path" \
    "$food_ad_container" \
    /opt/gflow-venv/bin/python \
    "$food_ad_container_dir/helper.py" \
    "$food_ad_project_id" \
    "$food_ad_container_output"
  food_ad_recover_status=$?
  set -e
  if [[ $food_ad_recover_status -eq 0 ]]; then
    docker cp "$food_ad_container:$food_ad_container_output/." "$food_ad_target/" >/dev/null
  fi
  exit $food_ad_recover_status
fi
