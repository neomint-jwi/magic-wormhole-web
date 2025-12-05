# Fork
# Wormhole Web

A modern web UI for [Magic Wormhole](https://magic-wormhole.readthedocs.io/) file transfers, built with Go and vanilla JavaScript. Send files, folders, and encrypted messages between devices using simple wormhole codes.

## Features

- **File Transfer**: Send single files or entire folders (automatically zipped)
- **Text Messages**: Send and receive text snippets
- **End-to-End Encryption**: Optional password protection using AES-256-GCM
- **Real-time Progress**: WebSocket-based transfer progress updates
- **Dark/Light Theme**: System-aware theme with manual toggle
- **Responsive Design**: Works on desktop and mobile
- **Zero Dependencies Frontend**: Pure vanilla JS, no framework bloat

## Quick Start

### Docker Compose (recommended)

```bash
docker compose up -d
```

Open http://localhost:8080 in your browser.

### Docker (pre-built image)

```bash
docker run -p 8080:8080 ghcr.io/neomint-research/magic-wormhole-web:latest
```

### Docker (build locally)

```bash
docker build -t wormhole-web .
docker run -p 8080:8080 wormhole-web
```

### Local Development

```bash
# Install Go dependencies
go mod tidy

# Run the server
go run main.go
```

## Usage

### Sending Files

1. Click the **Send** tab
2. Drag & drop files/folders or click to browse
3. Optionally enable encryption and set a password
4. Click **Send** to generate a wormhole code
5. Share the code (and password, if encrypted) with the recipient

### Receiving Files

1. Click the **Receive** tab
2. Enter the wormhole code (format: `number-word-word`)
3. If encrypted, enter the password when prompted
4. Download or copy the received content

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |

## Architecture

```
wormhole-web/
├── main.go              # Go backend server
├── static/
│   ├── index.html       # Single-page app shell
│   ├── app.js           # Application logic
│   ├── styles.css       # App styles with CSS variables
│   ├── particles.js     # Particle animation system
│   └── particles.css    # Particle styles (standalone)
├── Dockerfile           # Multi-stage build
└── docker-compose.yml   # Container orchestration
```

### Backend (Go)

- Embedded static files using `go:embed`
- WebSocket support for real-time progress updates
- Automatic temp file cleanup
- Uses [wormhole-william](https://github.com/psanford/wormhole-william) for Magic Wormhole protocol

### Frontend (Vanilla JS)

- State-based rendering without virtual DOM
- CSS custom properties for theming
- Web Crypto API for client-side encryption
- File System Access API for native save dialogs

### Particle Animation System

The particle animation is a standalone module that can be reused:

```html
<link rel="stylesheet" href="particles.css">
<script src="particles.js"></script>

<div class="particle-container" id="container"></div>

<script>
  const container = document.getElementById('container');

  // Start animation
  initParticles(container, 'up');     // Stream upward
  initParticles(container, 'down');   // Stream downward
  initParticles(container, 'drift');  // 3D rotating sphere

  // Morph to shapes
  morphParticlesToCheck(container);   // Green checkmark
  morphParticlesToError(container);   // Red X

  // Transitions
  transitionToDrift(container);       // Smooth stream-to-sphere transition
</script>
```

Customize colors via CSS variables:

```css
:root {
  --particle-color: #2563eb;    /* Default particle color */
  --particle-success: #16a34a;  /* Checkmark color */
  --particle-error: #ef4444;    /* Error X color */
}
```

## API Reference

### POST /api/send/text
Send a text message.

```json
{ "text": "Hello, world!" }
```

### POST /api/send/file
Send files via multipart form data.

- `file`: Single file upload
- `files`: Multiple files
- `paths`: JSON array of file paths (for folder structure)

### POST /api/receive
Receive content using a wormhole code.

```json
{ "code": "7-guitarist-revenge" }
```

### GET /api/ws?id={transferId}
WebSocket endpoint for real-time transfer status updates.

### GET /api/download/{transferId}/{filename}
Download received files.

## Security

- All transfers use Magic Wormhole's PAKE-based encryption
- Optional additional AES-256-GCM encryption for sensitive content
- No data stored on server after transfer completion
- Automatic cleanup of expired transfers (1 hour TTL)
- Path traversal protection on file downloads
- Input validation on wormhole codes and transfer IDs

## License

MIT
