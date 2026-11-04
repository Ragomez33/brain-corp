---
description: Publica los tickets del backlog como GitHub Issues.
agent: build
---

Sincroniza el backlog local con GitHub Issues.

1. Verifica que `gh auth status` tenga una sesión activa.
2. Ejecuta el sanity check previo:
   ```bash
   node scripts/sanity-check.js --write --json
   ```
3. Publica los tickets:
   ```bash
   node scripts/sync-github.js
   ```

No uses `--skip-sanity` salvo que el usuario lo solicite explícitamente.
