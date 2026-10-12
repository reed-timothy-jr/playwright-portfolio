# Master Linux Command List — QA Edition

*Owner: Timothy Reed Jr. The commands a QA/SDET actually reaches for: logs, processes, ports, files, HTTP probes, and test-run triage. Assumes bash on a Linux/CI box.*

## 1. Am I sane? — environment first

```bash
pwd; whoami; hostname; date          # where am I, as whom, and what time does this box think it is
cat /etc/os-release | head -3        # distro/version
node --version; npm --version        # runtime the suite will use
df -h . ; free -h                    # disk and memory headroom — full disks fake-fail suites
```

## 2. Files and searching

```bash
ls -lah                              # everything, human sizes
find . -name "*.spec.ts" -not -path "*/node_modules/*"
grep -rn "test.only" tests/          # the committed-focus check before any run
grep -rn "TODO\|FIXME" src/ tests/
tail -f app.log                      # follow a live log
tail -n 200 app.log                  # last 200 lines
less +F app.log                      # scrollable follow (Ctrl-C to search, Shift-F resumes)
wc -l results.json                   # quick size sanity
du -sh test-results/                 # traces and videos eat disks
```

## 3. Processes — what's running, what's stuck

```bash
ps aux | grep -i playwright          # find the run (and its zombies)
top                                  # live view; q to quit
pkill -f "playwright test"           # kill a hung run by pattern — check ps first
jobs; fg; bg                         # shell job control
nohup npm run test:all > run.log 2>&1 &   # start a long run that survives logout
```

## 4. Ports and networking — is the app actually up?

```bash
ss -tlnp                             # listening TCP ports (Linux)
curl -I http://localhost:3000        # headers only — status, server, caching
curl -s http://localhost:3000/health # health endpoint, body only
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://example.com   # status + total time
wget -qO- http://localhost:3000 | head   # curl alternative
ping -c 3 <host>                     # reachability only — not a diagnosis
dig +short <domain>                  # what DNS says
nslookup <domain>
```

## 5. HTTP probing for API testing

```bash
curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user":"qa","pass":"secret"}' | jq .        # jq makes JSON readable — use it always
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/me | jq .
curl -sv https://example.com 2>&1 | grep -E "^< HTTP|SSL|certificate"   # TLS + status debugging
```

## 6. Logs and failure triage

```bash
grep -iE "error|fail|timeout" run.log | sort | uniq -c | sort -rn | head   # what failed most
journalctl -u <service> --since "10 min ago" --no-pager                  # systemd service logs
dmesg | tail -20                                                         # kernel/OOM — the silent suite killer
ls -lt test-results/ | head                                              # newest failure artifacts first
find test-results -name "*.zip" -newer marker                            # traces produced since a point in time
```

## 7. Git — the daily five

```bash
git status --short                   # what have I touched
git log --oneline -10                # recent history, one line each
git diff --stat HEAD                 # blast radius of my changes
git stash push -m "wip" ; git stash pop   # park work, get it back
git blame -L 40,50 <file>            # who/when for these lines — for context, not blame
```

## 8. JSON, data, and quick edits

```bash
jq '.tests[] | select(.status=="failed") | .title' report.json   # pull failures out of a report
sed -n '120,160p' file.log           # print a line range
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head   # top talkers in an access log
sort | uniq -c | sort -rn            # the counting pipeline — memorize this shape
xargs -I{} echo {}                   # run a command per line of input
```

## 9. Permissions and ownership

```bash
ls -l <file>                         # who can do what
chmod +x script.sh                   # make executable
namei -l /path/to/file               # permission chain — finds the one locked directory
```

## 10. Safety rules

- `rm -rf` gets read **twice, out loud**, before Enter — and never with a variable you haven't echoed first.
- `pkill`/`kill` by pattern: run the matching `ps`/`pgrep` first and read the list.
- Production boxes: read-only commands by default; anything that writes gets said out loud before it runs.
- When a suite "fails weird," check the box before the code: `df -h`, `free -h`, `dmesg | tail` (§1, §6). Half of all phantom failures are a full disk or an OOM kill.
