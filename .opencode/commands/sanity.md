---
description: Ejecuta el sanity check de brain-corp sobre los tickets del workspace.
agent: build
---

Ejecuta el sanity check estructural y el análisis de coherencia de tickets.

```bash
node scripts/sanity-check.js --write --json
```

Después sigue el protocolo de `.opencode/commands/sanity-check.md`: corrige dominios, dependencias, duplicados y formato antes de sincronizar.
