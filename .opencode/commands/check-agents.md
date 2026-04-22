---
description: Report availability of Claude and Codex CLIs
---

!`
claude_ver=$(claude --version 2>/dev/null) && claude_status="✓ $claude_ver" || claude_status="✗ not found"
codex_ver=$(codex --version 2>/dev/null) && codex_status="✓ $codex_ver" || codex_status="✗ not found"
printf "| Agent  | Binary  | Status |\n|--------|---------|--------|\n| claude | claude  | %s |\n| codex  | codex   | %s |\n" "$claude_status" "$codex_status"
`
