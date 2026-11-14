#!/usr/bin/env sh
# Stop every local Next.js dev server for this machine.
#
# Why a script: the real listener is a child process titled
# `next-server (vX)`, whose command line doesn't contain "next dev", so
# `pkill -f "next dev"` (or stopping the npm task that started it) leaves it
# holding port 3000. The next `npm run dev` then exits with "Port 3000 is in
# use" and you test a stale build without noticing.
#
# The `[n]ext` bracket trick stops the pattern matching its own command line —
# a plain `pgrep -f next-server` matches the shell running it and kills that.

pids=$(pgrep -f "[n]ext-server|[n]ext dev")
if [ -z "$pids" ]; then
  echo "No dev server running."
  exit 0
fi

kill $pids
sleep 1
if pgrep -f "[n]ext-server|[n]ext dev" > /dev/null; then
  echo "Still running after SIGTERM; sending SIGKILL." >&2
  kill -9 $(pgrep -f "[n]ext-server|[n]ext dev") 2> /dev/null
fi
echo "Stopped dev server (pids: $(echo $pids | tr '\n' ' '))."
