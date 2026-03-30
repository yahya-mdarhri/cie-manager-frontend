# cie-manager-frontend

## Run with Docker Compose

Use the dedicated frontend compose file in this folder:

```bash
docker compose up -d --build
```

Optional: override API base URL at build time:

```bash
NEXT_PUBLIC_API_BASE=http://192.168.1.171:12000 docker compose up -d --build
```