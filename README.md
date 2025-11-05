# Comparator Web UI

A Vite + React application that lets you paste a payload containing `expected` and `actual` JSON sections, computes a structural diff, and highlights mismatches with both path-based insights and a unified diff view.

## Local Development

```bash
npm install
npm run dev
```

The dev server runs on [http://localhost:5173](http://localhost:5173).

### Testing

```bash
npm test
# or run once in CI mode
npm run test:run
```

### Production Build

```bash
npm run build
npm run preview
```

## Docker Image

### Run from GitHub Container Registry

```bash
docker run --rm -p 8080:8080 ghcr.io/neiios/comparator-web-ui:latest
```

The application will be available at [http://localhost:8080](http://localhost:8080)

