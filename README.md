# JSON Comparator Web UI

A Vite + React application that lets you paste a payload containing `expected` and `actual` JSON sections, computes a structural diff, and highlights mismatches with both path-based insights and a unified diff view.

## Local Development

```bash
npm install
npm run dev
```

The dev server runs on [http://localhost:5173](http://localhost:5173) with hot module replacement.

### Testing

```bash
npm run test
# or run once in CI mode
npm run test:run
```

### Production Build

```bash
npm run build
npm run preview
```

## Docker

This project ships with a multi-stage Dockerfile that builds the static assets and serves them via NGINX running as a non-root user.

### Build the image

```bash
docker build -t comparator-web-ui .
```

### Run the container

```bash
docker run --rm -p 8080:8080 comparator-web-ui
```

The application is now available at [http://localhost:8080](http://localhost:8080). The image serves content through NGINX with security headers and a read-only runtime filesystem.

### Environment Variables

This is a static application, so runtime configuration should be baked into the build or served via the hosting environment.
