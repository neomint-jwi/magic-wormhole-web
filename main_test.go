package main

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// ============================================================
// VALIDATION FUNCTION TESTS
// ============================================================

func TestValidateWormholeCode(t *testing.T) {
	tests := []struct {
		name  string
		code  string
		valid bool
	}{
		{"valid code", "7-guitarist-revenge", true},
		{"valid code with numbers", "123-hello-world", true},
		{"valid code single digit", "1-foo-bar", true},
		{"empty string", "", false},
		{"missing number", "guitarist-revenge", false},
		{"missing first word", "7--revenge", false},
		{"missing second word", "7-guitarist-", false},
		{"too many parts", "7-guitarist-revenge-extra", false},
		{"numbers in words", "7-guitar1st-revenge", false},
		{"special characters", "7-guitarist-revenge!", false},
		{"spaces", "7-guitarist revenge", false},
		{"uppercase", "7-GUITARIST-REVENGE", true},
		{"mixed case", "7-Guitar-Revenge", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := validateWormholeCode(tt.code)
			if got != tt.valid {
				t.Errorf("validateWormholeCode(%q) = %v, want %v", tt.code, got, tt.valid)
			}
		})
	}
}

func TestValidateTransferID(t *testing.T) {
	tests := []struct {
		name  string
		id    string
		valid bool
	}{
		{"valid send ID", "send-1234567890", true},
		{"valid recv ID", "recv-9876543210", true},
		{"empty string", "", false},
		{"missing prefix", "1234567890", false},
		{"wrong prefix", "upload-1234567890", false},
		{"missing timestamp", "send-", false},
		{"non-numeric timestamp", "send-abc", false},
		{"spaces", "send- 123", false},
		{"path traversal attempt", "send-123/../../../etc/passwd", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := validateTransferID(tt.id)
			if got != tt.valid {
				t.Errorf("validateTransferID(%q) = %v, want %v", tt.id, got, tt.valid)
			}
		})
	}
}

// ============================================================
// SANITIZE FILENAME TESTS
// ============================================================

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"simple filename", "document.pdf", "document.pdf"},
		{"filename with spaces", "my document.pdf", "my document.pdf"},
		{"path traversal attempt", "../../../etc/passwd", "passwd"},
		{"absolute path", "/etc/passwd", "passwd"},
		{"windows path", "C:\\Users\\test\\file.txt", "file.txt"},
		{"null bytes", "file\x00name.txt", "filename.txt"},
		{"control characters", "file\x01\x02name.txt", "filename.txt"},
		{"empty string", "", "unnamed"},
		{"dot", ".", "unnamed"},
		{"double dot", "..", "unnamed"},
		{"hidden file", ".hidden", ".hidden"},
		{"unicode filename", "文档.pdf", "文档.pdf"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeFilename(tt.input)
			if got != tt.expected {
				t.Errorf("sanitizeFilename(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestSanitizeFilenameTruncation(t *testing.T) {
	// Create a filename longer than maxFilenameLen
	longName := strings.Repeat("a", 300) + ".txt"
	result := sanitizeFilename(longName)

	if len(result) > maxFilenameLen {
		t.Errorf("sanitizeFilename did not truncate: got length %d, want <= %d", len(result), maxFilenameLen)
	}

	// Should preserve extension
	if !strings.HasSuffix(result, ".txt") {
		t.Errorf("sanitizeFilename did not preserve extension: got %q", result)
	}
}

// ============================================================
// SERVER TRANSFER MANAGEMENT TESTS
// ============================================================

func TestServerTransferManagement(t *testing.T) {
	server := NewServer()

	// Test setTransfer and getTransfer
	transfer := &TransferStatus{
		ID:        "send-123456789",
		Type:      "send",
		Status:    "waiting",
		Code:      "7-test-code",
		CreatedAt: time.Now(),
	}

	server.setTransfer(transfer)

	got := server.getTransfer("send-123456789")
	if got == nil {
		t.Fatal("getTransfer returned nil for existing transfer")
	}
	if got.ID != transfer.ID {
		t.Errorf("getTransfer().ID = %q, want %q", got.ID, transfer.ID)
	}
	if got.Code != transfer.Code {
		t.Errorf("getTransfer().Code = %q, want %q", got.Code, transfer.Code)
	}

	// Test getTransfer for non-existent ID
	notFound := server.getTransfer("send-nonexistent")
	if notFound != nil {
		t.Error("getTransfer should return nil for non-existent transfer")
	}

	// Test deleteTransfer
	server.deleteTransfer("send-123456789")
	deleted := server.getTransfer("send-123456789")
	if deleted != nil {
		t.Error("getTransfer should return nil after deleteTransfer")
	}
}

// ============================================================
// HTTP HANDLER TESTS
// ============================================================

func TestHandleSendTextMethodNotAllowed(t *testing.T) {
	server := NewServer()

	req := httptest.NewRequest(http.MethodGet, "/api/send/text", nil)
	w := httptest.NewRecorder()

	server.handleSendText(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("handleSendText GET: got status %d, want %d", w.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandleSendTextEmptyBody(t *testing.T) {
	server := NewServer()

	body := strings.NewReader(`{"text":""}`)
	req := httptest.NewRequest(http.MethodPost, "/api/send/text", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.handleSendText(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("handleSendText empty text: got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleSendTextInvalidJSON(t *testing.T) {
	server := NewServer()

	body := strings.NewReader(`not json`)
	req := httptest.NewRequest(http.MethodPost, "/api/send/text", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.handleSendText(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("handleSendText invalid JSON: got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleReceiveMethodNotAllowed(t *testing.T) {
	server := NewServer()

	req := httptest.NewRequest(http.MethodGet, "/api/receive", nil)
	w := httptest.NewRecorder()

	server.handleReceive(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("handleReceive GET: got status %d, want %d", w.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandleReceiveEmptyCode(t *testing.T) {
	server := NewServer()

	body := strings.NewReader(`{"code":""}`)
	req := httptest.NewRequest(http.MethodPost, "/api/receive", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.handleReceive(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("handleReceive empty code: got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleReceiveInvalidCodeFormat(t *testing.T) {
	server := NewServer()

	body := strings.NewReader(`{"code":"invalid-code"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/receive", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.handleReceive(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("handleReceive invalid code format: got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleStatusMissingID(t *testing.T) {
	server := NewServer()

	req := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	w := httptest.NewRecorder()

	server.handleStatus(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("handleStatus missing ID: got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleStatusNotFound(t *testing.T) {
	server := NewServer()

	req := httptest.NewRequest(http.MethodGet, "/api/status?id=send-nonexistent", nil)
	w := httptest.NewRecorder()

	server.handleStatus(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("handleStatus not found: got status %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestHandleStatusSuccess(t *testing.T) {
	server := NewServer()

	// Create a transfer first
	transfer := &TransferStatus{
		ID:        "send-123456789",
		Type:      "send",
		Status:    "waiting",
		Code:      "7-test-code",
		CreatedAt: time.Now(),
	}
	server.setTransfer(transfer)

	req := httptest.NewRequest(http.MethodGet, "/api/status?id=send-123456789", nil)
	w := httptest.NewRecorder()

	server.handleStatus(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("handleStatus success: got status %d, want %d", w.Code, http.StatusOK)
	}

	var response TransferStatus
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response.ID != transfer.ID {
		t.Errorf("Response ID = %q, want %q", response.ID, transfer.ID)
	}
	if response.Code != transfer.Code {
		t.Errorf("Response Code = %q, want %q", response.Code, transfer.Code)
	}
}

func TestHandleDownloadInvalidPath(t *testing.T) {
	server := NewServer()

	req := httptest.NewRequest(http.MethodGet, "/api/download/invalidpath", nil)
	w := httptest.NewRecorder()

	server.handleDownload(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("handleDownload invalid path: got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleDownloadInvalidTransferID(t *testing.T) {
	server := NewServer()

	req := httptest.NewRequest(http.MethodGet, "/api/download/invalid-id/file.txt", nil)
	w := httptest.NewRecorder()

	server.handleDownload(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("handleDownload invalid transfer ID: got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleDownloadTransferNotFound(t *testing.T) {
	server := NewServer()

	req := httptest.NewRequest(http.MethodGet, "/api/download/recv-123456789/file.txt", nil)
	w := httptest.NewRecorder()

	server.handleDownload(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("handleDownload transfer not found: got status %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestHandleDownloadPathTraversal(t *testing.T) {
	server := NewServer()

	// Create a transfer
	transfer := &TransferStatus{
		ID:        "recv-123456789",
		Type:      "receive",
		Status:    "complete",
		CreatedAt: time.Now(),
	}
	server.setTransfer(transfer)

	// Attempt path traversal
	req := httptest.NewRequest(http.MethodGet, "/api/download/recv-123456789/../../../etc/passwd", nil)
	w := httptest.NewRecorder()

	server.handleDownload(w, req)

	// Should be sanitized - the filename becomes "passwd" after sanitization
	// and since the file doesn't exist, it should return 404
	if w.Code == http.StatusOK {
		t.Error("handleDownload should not serve files outside temp directory")
	}
}

func TestHandleSendFileMethodNotAllowed(t *testing.T) {
	server := NewServer()

	req := httptest.NewRequest(http.MethodGet, "/api/send/file", nil)
	w := httptest.NewRecorder()

	server.handleSendFile(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("handleSendFile GET: got status %d, want %d", w.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandleSendFileNoFile(t *testing.T) {
	server := NewServer()

	// Create empty multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/send/file", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()

	server.handleSendFile(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("handleSendFile no file: got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ============================================================
// PROGRESS READER TESTS
// ============================================================

func TestProgressReader(t *testing.T) {
	data := []byte("Hello, World!")
	reader := bytes.NewReader(data)

	var progressCalls int
	var lastProgress int64

	pr := &progressReader{
		reader: reader,
		onProgress: func(n int64) {
			progressCalls++
			lastProgress = n
		},
	}

	buf := make([]byte, 5)

	// First read
	n, err := pr.Read(buf)
	if err != nil {
		t.Fatalf("Read error: %v", err)
	}
	if n != 5 {
		t.Errorf("Read returned %d bytes, want 5", n)
	}
	if progressCalls != 1 {
		t.Errorf("Progress called %d times, want 1", progressCalls)
	}
	if lastProgress != 5 {
		t.Errorf("Last progress = %d, want 5", lastProgress)
	}

	// Second read
	n, err = pr.Read(buf)
	if err != nil {
		t.Fatalf("Read error: %v", err)
	}
	if progressCalls != 2 {
		t.Errorf("Progress called %d times, want 2", progressCalls)
	}
	if lastProgress != 10 {
		t.Errorf("Last progress = %d, want 10", lastProgress)
	}

	// Read until EOF
	_, _ = io.ReadAll(pr)
	if lastProgress != int64(len(data)) {
		t.Errorf("Final progress = %d, want %d", lastProgress, len(data))
	}
}

// ============================================================
// CLEANUP ROUTINE TESTS
// ============================================================

func TestCleanupOldTransfers(t *testing.T) {
	server := NewServer()

	// Create temp directory for testing
	testDir := filepath.Join(os.TempDir(), "wormhole-web-test")
	server.tempDir = testDir
	os.MkdirAll(testDir, 0755)
	defer os.RemoveAll(testDir)

	// Create an old transfer (older than TTL)
	oldTransfer := &TransferStatus{
		ID:        "send-old",
		Type:      "send",
		Status:    "complete",
		CreatedAt: time.Now().Add(-2 * transferTTL), // 2x TTL ago
	}
	server.setTransfer(oldTransfer)

	// Create old transfer's temp directory
	oldTransferDir := filepath.Join(testDir, "send-old")
	os.MkdirAll(oldTransferDir, 0755)
	os.WriteFile(filepath.Join(oldTransferDir, "test.txt"), []byte("test"), 0644)

	// Create a new transfer (within TTL)
	newTransfer := &TransferStatus{
		ID:        "send-new",
		Type:      "send",
		Status:    "waiting",
		CreatedAt: time.Now(),
	}
	server.setTransfer(newTransfer)

	// Run cleanup
	server.cleanupOldTransfers()

	// Old transfer should be deleted
	if server.getTransfer("send-old") != nil {
		t.Error("Old transfer should have been cleaned up")
	}

	// Old transfer's directory should be deleted
	if _, err := os.Stat(oldTransferDir); !os.IsNotExist(err) {
		t.Error("Old transfer directory should have been deleted")
	}

	// New transfer should still exist
	if server.getTransfer("send-new") == nil {
		t.Error("New transfer should not have been cleaned up")
	}
}

// ============================================================
// INTEGRATION TESTS
// ============================================================

func TestNewServer(t *testing.T) {
	server := NewServer()

	if server == nil {
		t.Fatal("NewServer returned nil")
	}

	if server.tempDir == "" {
		t.Error("Server tempDir should not be empty")
	}

	expectedSuffix := filepath.Join("wormhole-web")
	if !strings.HasSuffix(server.tempDir, expectedSuffix) {
		t.Errorf("Server tempDir = %q, should end with %q", server.tempDir, expectedSuffix)
	}
}

// ============================================================
// WEBSOCKET HANDLER TESTS
// ============================================================

func TestHandleWebSocketMissingID(t *testing.T) {
	server := NewServer()

	req := httptest.NewRequest(http.MethodGet, "/api/ws", nil)
	w := httptest.NewRecorder()

	server.handleWebSocket(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("handleWebSocket missing ID: got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleWebSocketInvalidID(t *testing.T) {
	server := NewServer()

	req := httptest.NewRequest(http.MethodGet, "/api/ws?id=invalid", nil)
	w := httptest.NewRecorder()

	server.handleWebSocket(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("handleWebSocket invalid ID: got status %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleWebSocketTransferNotFound(t *testing.T) {
	server := NewServer()

	req := httptest.NewRequest(http.MethodGet, "/api/ws?id=send-123456789", nil)
	w := httptest.NewRecorder()

	server.handleWebSocket(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("handleWebSocket not found: got status %d, want %d", w.Code, http.StatusNotFound)
	}
}

// ============================================================
// SUBSCRIBER MANAGEMENT TESTS
// ============================================================

func TestSubscriberManagement(t *testing.T) {
	server := NewServer()

	// Test that subscribers map starts empty
	transfer := &TransferStatus{
		ID:        "send-123",
		Type:      "send",
		Status:    "waiting",
		CreatedAt: time.Now(),
	}
	server.setTransfer(transfer)

	// Notify with no subscribers should not panic
	server.notifySubscribers(transfer)
}
