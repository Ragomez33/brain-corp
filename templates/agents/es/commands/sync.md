---
description: Publica los tickets del backlog como GitHub Issues.
agent: build
---

Sincroniza el backlog local con GitHub Issues.

1. Verifica que `gh auth status` tenga una sesión activa.
2. Ejecuta el sanity check previo:
   ```bash
   brain sanity --write --json
   ```
3. Publica los tickets:
   ```bash
   brain sync
   ```

No uses `--skip-sanity` salvo que el usuario lo solicite explícitamente.
