package main

import (
	"archive/zip"
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/psanford/wormhole-william/wormhole"
)

const (
	// Transfer cleanup settings
	transferTTL      = 1 * time.Hour
	cleanupInterval  = 5 * time.Minute
	maxFilenameLen   = 255
	shutdownTimeout  = 30 * time.Second
)

//go:embed static/*
var staticFiles embed.FS

type TransferStatus struct {
	ID           string    `json:"id"`
	Type         string    `json:"type"` // "send" or "receive"
	Status       string    `json:"status"`
	Code         string    `json:"code,omitempty"`
	Filename     string    `json:"filename,omitempty"`
	Progress     float64   `json:"progress"`
	Transferred  int64     `json:"transferred"`
	Total        int64     `json:"total"`
	Error        string    `json:"error,omitempty"`
	TextContent  string    `json:"textContent,omitempty"`
	DownloadPath string    `json:"downloadPath,omitempty"`
	CreatedAt    time.Time `json:"-"`
}

// Validation patterns
var (
	// Wormhole codes are: number-word-word (e.g., "7-guitarist-revenge")
	wormholeCodePattern = regexp.MustCompile(`^\d+-[a-zA-Z]+-[a-zA-Z]+$`)
	// Transfer IDs are: send-{timestamp} or recv-{timestamp}
	transferIDPattern = regexp.MustCompile(`^(send|recv)-\d+$`)
)

type Server struct {
	transfers   sync.Map
	subscribers sync.Map // map[transferID]map[*websocket.Conn]bool
	mu          sync.Mutex
	tempDir     string
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow same-origin connections
	},
}

func NewServer() *Server {
	tempDir := os.TempDir()
	return &Server{
		tempDir: filepath.Join(tempDir, "wormhole-web"),
	}
}

func (s *Server) getTransfer(id string) *TransferStatus {
	if val, ok := s.transfers.Load(id); ok {
		return val.(*TransferStatus)
	}
	return nil
}

func (s *Server) setTransfer(t *TransferStatus) {
	s.transfers.Store(t.ID, t)
	s.notifySubscribers(t)
}

func (s *Server) deleteTransfer(id string) {
	s.transfers.Delete(id)
}

// WebSocket subscriber management
func (s *Server) addSubscriber(transferID string, conn *websocket.Conn) {
	actual, _ := s.subscribers.LoadOrStore(transferID, &sync.Map{})
	subscribers := actual.(*sync.Map)
	subscribers.Store(conn, true)
}

func (s *Server) removeSubscriber(transferID string, conn *websocket.Conn) {
	if val, ok := s.subscribers.Load(transferID); ok {
		subscribers := val.(*sync.Map)
		subscribers.Delete(conn)
	}
}

func (s *Server) notifySubscribers(t *TransferStatus) {
	if val, ok := s.subscribers.Load(t.ID); ok {
		subscribers := val.(*sync.Map)
		data, err := json.Marshal(t)
		if err != nil {
			return
		}
		subscribers.Range(func(key, _ any) bool {
			conn := key.(*websocket.Conn)
			conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
				conn.Close()
				subscribers.Delete(conn)
			}
			return true
		})
	}
}

// sanitizeFilename removes path separators and dangerous characters from filenames
func sanitizeFilename(name string) string {
	// Remove any path components
	name = filepath.Base(name)
	// Remove null bytes and other control characters
	name = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, name)
	// Truncate if too long
	if len(name) > maxFilenameLen {
		ext := filepath.Ext(name)
		base := name[:maxFilenameLen-len(ext)]
		name = base + ext
	}
	// Fallback for empty names
	if name == "" || name == "." || name == ".." {
		name = "unnamed"
	}
	return name
}

// validateWormholeCode checks if the code matches expected format
func validateWormholeCode(code string) bool {
	return wormholeCodePattern.MatchString(code)
}

// validateTransferID checks if the transfer ID matches expected format
func validateTransferID(id string) bool {
	return transferIDPattern.MatchString(id)
}

// startCleanupRoutine periodically removes old transfers and their files
func (s *Server) startCleanupRoutine() {
	ticker := time.NewTicker(cleanupInterval)
	go func() {
		for range ticker.C {
			s.cleanupOldTransfers()
		}
	}()
}

func (s *Server) cleanupOldTransfers() {
	now := time.Now()
	var toDelete []string

	s.transfers.Range(func(key, value any) bool {
		id := key.(string)
		transfer := value.(*TransferStatus)

		// Only cleanup completed, errored, or expired transfers
		age := now.Sub(transfer.CreatedAt)
		if age > transferTTL {
			toDelete = append(toDelete, id)
		}
		return true
	})

	for _, id := range toDelete {
		// Remove temp files if they exist
		transferDir := filepath.Join(s.tempDir, id)
		os.RemoveAll(transferDir)
		s.transfers.Delete(id)
		log.Printf("Cleaned up expired transfer: %s", id)
	}
}

// API Handlers

func (s *Server) handleSendText(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Text == "" {
		http.Error(w, "Text is required", http.StatusBadRequest)
		return
	}

	transferID := fmt.Sprintf("send-%d", time.Now().UnixNano())
	transfer := &TransferStatus{
		ID:        transferID,
		Type:      "send",
		Status:    "sending",
		CreatedAt: time.Now(),
	}
	s.setTransfer(transfer)

	go func() {
		ctx := context.Background()
		var c wormhole.Client

		code, status, err := c.SendText(ctx, req.Text)
		if err != nil {
			transfer.Status = "error"
			transfer.Error = err.Error()
			s.setTransfer(transfer)
			return
		}

		transfer.Code = code
		transfer.Status = "waiting"
		s.setTransfer(transfer)

		// Wait for transfer to complete
		result := <-status
		if result.Error != nil {
			transfer.Status = "error"
			transfer.Error = result.Error.Error()
		} else if result.OK {
			transfer.Status = "complete"
		}
		s.setTransfer(transfer)
	}()

	json.NewEncoder(w).Encode(map[string]string{
		"id": transferID,
	})
}

func (s *Server) handleSendFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form (max 500MB total)
	if err := r.ParseMultipartForm(500 << 20); err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Get all files from the form
	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		// Fallback to single file field for backwards compatibility
		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "At least one file is required", http.StatusBadRequest)
			return
		}
		defer file.Close()

		// Single file - send directly
		s.sendSingleFile(w, file, header)
		return
	}

	// Multiple files or files with paths - create zip
	s.sendMultipleFiles(w, r, files)
}

func (s *Server) sendSingleFile(w http.ResponseWriter, file multipart.File, header *multipart.FileHeader) {
	safeFilename := sanitizeFilename(header.Filename)

	transferID := fmt.Sprintf("send-%d", time.Now().UnixNano())
	transferDir := filepath.Join(s.tempDir, transferID)
	if err := os.MkdirAll(transferDir, 0755); err != nil {
		http.Error(w, "Failed to create temp directory", http.StatusInternalServerError)
		return
	}

	tempPath := filepath.Join(transferDir, safeFilename)
	dst, err := os.Create(tempPath)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	if _, err := io.Copy(dst, file); err != nil {
		dst.Close()
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	dst.Close()

	transfer := &TransferStatus{
		ID:        transferID,
		Type:      "send",
		Status:    "sending",
		Filename:  safeFilename,
		Total:     header.Size,
		CreatedAt: time.Now(),
	}
	s.setTransfer(transfer)

	go func() {
		defer os.RemoveAll(transferDir)

		ctx := context.Background()
		var c wormhole.Client

		f, err := os.Open(tempPath)
		if err != nil {
			transfer.Status = "error"
			transfer.Error = err.Error()
			s.setTransfer(transfer)
			return
		}
		defer f.Close()

		code, status, err := c.SendFile(ctx, safeFilename, f)
		if err != nil {
			transfer.Status = "error"
			transfer.Error = err.Error()
			s.setTransfer(transfer)
			return
		}

		transfer.Code = code
		transfer.Status = "waiting"
		s.setTransfer(transfer)

		result := <-status
		if result.Error != nil {
			transfer.Status = "error"
			transfer.Error = result.Error.Error()
		} else if result.OK {
			transfer.Status = "complete"
		}
		s.setTransfer(transfer)
	}()

	json.NewEncoder(w).Encode(map[string]string{
		"id": transferID,
	})
}

func (s *Server) sendMultipleFiles(w http.ResponseWriter, r *http.Request, files []*multipart.FileHeader) {
	transferID := fmt.Sprintf("send-%d", time.Now().UnixNano())
	transferDir := filepath.Join(s.tempDir, transferID)
	if err := os.MkdirAll(transferDir, 0755); err != nil {
		http.Error(w, "Failed to create temp directory", http.StatusInternalServerError)
		return
	}

	// Determine zip filename
	zipName := "files.zip"
	if len(files) == 1 {
		// Check if it's a folder upload by looking at the path
		if path := r.FormValue("paths"); path != "" {
			// Use folder name if available
			parts := strings.Split(path, "/")
			if len(parts) > 0 && parts[0] != "" {
				zipName = sanitizeFilename(parts[0]) + ".zip"
			}
		}
	}

	// Get file paths if provided (for folder structure preservation)
	pathsJSON := r.FormValue("paths")
	var filePaths []string
	if pathsJSON != "" {
		json.Unmarshal([]byte(pathsJSON), &filePaths)
	}

	// Create zip file
	zipPath := filepath.Join(transferDir, zipName)
	zipFile, err := os.Create(zipPath)
	if err != nil {
		http.Error(w, "Failed to create archive", http.StatusInternalServerError)
		return
	}

	zipWriter := zip.NewWriter(zipFile)
	var totalSize int64

	for i, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			zipWriter.Close()
			zipFile.Close()
			http.Error(w, "Failed to read uploaded file", http.StatusInternalServerError)
			return
		}

		// Use provided path or just filename
		var entryPath string
		if i < len(filePaths) && filePaths[i] != "" {
			// Sanitize each path component
			parts := strings.Split(filePaths[i], "/")
			for j, part := range parts {
				parts[j] = sanitizeFilename(part)
			}
			entryPath = strings.Join(parts, "/")
		} else {
			entryPath = sanitizeFilename(fileHeader.Filename)
		}

		// Create entry in zip
		zipEntry, err := zipWriter.Create(entryPath)
		if err != nil {
			file.Close()
			zipWriter.Close()
			zipFile.Close()
			http.Error(w, "Failed to create archive entry", http.StatusInternalServerError)
			return
		}

		written, err := io.Copy(zipEntry, file)
		file.Close()
		if err != nil {
			zipWriter.Close()
			zipFile.Close()
			http.Error(w, "Failed to write to archive", http.StatusInternalServerError)
			return
		}
		totalSize += written
	}

	zipWriter.Close()
	zipFile.Close()

	// Get actual zip file size
	zipInfo, _ := os.Stat(zipPath)
	zipSize := zipInfo.Size()

	transfer := &TransferStatus{
		ID:        transferID,
		Type:      "send",
		Status:    "sending",
		Filename:  zipName,
		Total:     zipSize,
		CreatedAt: time.Now(),
	}
	s.setTransfer(transfer)

	go func() {
		defer os.RemoveAll(transferDir)

		ctx := context.Background()
		var c wormhole.Client

		f, err := os.Open(zipPath)
		if err != nil {
			transfer.Status = "error"
			transfer.Error = err.Error()
			s.setTransfer(transfer)
			return
		}
		defer f.Close()

		code, status, err := c.SendFile(ctx, zipName, f)
		if err != nil {
			transfer.Status = "error"
			transfer.Error = err.Error()
			s.setTransfer(transfer)
			return
		}

		transfer.Code = code
		transfer.Status = "waiting"
		s.setTransfer(transfer)

		result := <-status
		if result.Error != nil {
			transfer.Status = "error"
			transfer.Error = result.Error.Error()
		} else if result.OK {
			transfer.Status = "complete"
		}
		s.setTransfer(transfer)
	}()

	json.NewEncoder(w).Encode(map[string]string{
		"id": transferID,
	})
}

func (s *Server) handleReceive(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Code == "" {
		http.Error(w, "Code is required", http.StatusBadRequest)
		return
	}

	// Validate wormhole code format
	if !validateWormholeCode(req.Code) {
		http.Error(w, "Invalid wormhole code format", http.StatusBadRequest)
		return
	}

	transferID := fmt.Sprintf("recv-%d", time.Now().UnixNano())
	transfer := &TransferStatus{
		ID:        transferID,
		Type:      "receive",
		Status:    "receiving",
		Code:      req.Code,
		CreatedAt: time.Now(),
	}
	s.setTransfer(transfer)

	go func() {
		ctx := context.Background()
		var c wormhole.Client

		msg, err := c.Receive(ctx, req.Code)
		if err != nil {
			transfer.Status = "error"
			transfer.Error = err.Error()
			s.setTransfer(transfer)
			return
		}

		// Sanitize received filename
		safeFilename := sanitizeFilename(msg.Name)

		transfer.Total = msg.TransferBytes64
		transfer.Filename = safeFilename
		s.setTransfer(transfer)

		// Check if it's a text message
		if msg.Type == wormhole.TransferText {
			var buf bytes.Buffer
			if _, err := io.Copy(&buf, msg); err != nil {
				transfer.Status = "error"
				transfer.Error = err.Error()
				s.setTransfer(transfer)
				return
			}
			transfer.Status = "complete"
			transfer.TextContent = buf.String()
			transfer.Transferred = int64(buf.Len())
			s.setTransfer(transfer)
			return
		}

		// Save file to temp directory
		transferDir := filepath.Join(s.tempDir, transferID)
		if err := os.MkdirAll(transferDir, 0755); err != nil {
			transfer.Status = "error"
			transfer.Error = err.Error()
			s.setTransfer(transfer)
			return
		}

		destPath := filepath.Join(transferDir, safeFilename)
		f, err := os.Create(destPath)
		if err != nil {
			transfer.Status = "error"
			transfer.Error = err.Error()
			s.setTransfer(transfer)
			return
		}

		// Track progress while receiving
		written, err := io.Copy(f, &progressReader{
			reader: msg,
			onProgress: func(n int64) {
				transfer.Transferred = n
				transfer.Progress = float64(n) / float64(transfer.Total) * 100
				s.setTransfer(transfer)
			},
		})
		f.Close()

		if err != nil {
			transfer.Status = "error"
			transfer.Error = err.Error()
			s.setTransfer(transfer)
			return
		}

		transfer.Status = "complete"
		transfer.Transferred = written
		transfer.Progress = 100
		transfer.DownloadPath = fmt.Sprintf("/api/download/%s/%s", transferID, safeFilename)
		s.setTransfer(transfer)
	}()

	json.NewEncoder(w).Encode(map[string]string{
		"id": transferID,
	})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	transfer := s.getTransfer(id)
	if transfer == nil {
		http.Error(w, "Transfer not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(transfer)
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	// Validate transfer ID
	if !validateTransferID(id) {
		http.Error(w, "Invalid transfer ID", http.StatusBadRequest)
		return
	}

	// Check if transfer exists
	transfer := s.getTransfer(id)
	if transfer == nil {
		http.Error(w, "Transfer not found", http.StatusNotFound)
		return
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Register subscriber
	s.addSubscriber(id, conn)
	defer s.removeSubscriber(id, conn)

	// Send current status immediately
	data, _ := json.Marshal(transfer)
	conn.WriteMessage(websocket.TextMessage, data)

	// Keep connection alive and handle client disconnect
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request) {
	// Parse /api/download/{transferID}/{filename}
	path := r.URL.Path[len("/api/download/"):]

	// Find the first slash to split transferID and filename
	slashIdx := strings.Index(path, "/")
	if slashIdx == -1 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	transferID := path[:slashIdx]
	filename := path[slashIdx+1:]

	// Validate transfer ID format to prevent path traversal
	if !validateTransferID(transferID) {
		http.Error(w, "Invalid transfer ID", http.StatusBadRequest)
		return
	}

	// Sanitize filename to prevent path traversal
	safeFilename := sanitizeFilename(filename)
	if safeFilename == "" {
		http.Error(w, "Invalid filename", http.StatusBadRequest)
		return
	}

	// Verify the transfer exists and is complete
	transfer := s.getTransfer(transferID)
	if transfer == nil {
		http.Error(w, "Transfer not found", http.StatusNotFound)
		return
	}

	// Build the file path safely
	filePath := filepath.Join(s.tempDir, transferID, safeFilename)

	// Final safety check: ensure path is within tempDir
	absFilePath, err := filepath.Abs(filePath)
	if err != nil {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	absTempDir, err := filepath.Abs(s.tempDir)
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}
	if !strings.HasPrefix(absFilePath, absTempDir+string(filepath.Separator)) {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	http.ServeFile(w, r, filePath)
}

type progressReader struct {
	reader     io.Reader
	onProgress func(int64)
	total      int64
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.reader.Read(p)
	pr.total += int64(n)
	if pr.onProgress != nil {
		pr.onProgress(pr.total)
	}
	return n, err
}

func main() {
	server := NewServer()

	// Ensure temp directory exists
	os.MkdirAll(server.tempDir, 0755)

	// Start cleanup routine for expired transfers
	server.startCleanupRoutine()

	// Set up router
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/send/text", server.handleSendText)
	mux.HandleFunc("/api/send/file", server.handleSendFile)
	mux.HandleFunc("/api/receive", server.handleReceive)
	mux.HandleFunc("/api/status", server.handleStatus)
	mux.HandleFunc("/api/ws", server.handleWebSocket)
	mux.HandleFunc("/api/download/", server.handleDownload)

	// Serve static files from embedded filesystem
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatal(err)
	}
	mux.Handle("/", http.FileServer(http.FS(staticFS)))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	httpServer := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	// Channel to listen for shutdown signals
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Start server in goroutine
	go func() {
		log.Printf("Starting wormhole-web server on port %s", port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for shutdown signal
	<-quit
	log.Println("Shutting down server...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	// Attempt graceful shutdown
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	// Clean up temp directory
	os.RemoveAll(server.tempDir)
	log.Println("Server stopped")
}
