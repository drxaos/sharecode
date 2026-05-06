package api

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"

	"sharecode/internal/logger"
	"sharecode/internal/room"
	"sharecode/internal/ws"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type Handler struct {
	store    *room.Store
	registry *ws.Registry
}

func NewHandler(store *room.Store, registry *ws.Registry) *Handler {
	return &Handler{store: store, registry: registry}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/rooms", h.corsMiddleware(h.createRoom))
	mux.HandleFunc("GET /api/rooms/{id}", h.corsMiddleware(h.getRoom))
	mux.HandleFunc("DELETE /api/rooms/{id}", h.corsMiddleware(h.deleteRoom))
	mux.HandleFunc("GET /ws/{roomId}", h.corsMiddleware(h.handleWS))
}

func (h *Handler) corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.Index(xff, ","); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

func (h *Handler) createRoom(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r)
	rm, err := h.store.Create(ip)
	if err != nil {
		log.Printf("[api] POST /api/rooms from %s: rate limit exceeded", ip)
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many rooms"})
		return
	}
	logger.Debug("[api] POST /api/rooms from %s: created room %s", ip, rm.ID)

	hub := ws.NewHub(rm.ID, h.store, h.registry)
	h.registry.Set(rm.ID, hub)
	go hub.Run()

	writeJSON(w, http.StatusCreated, map[string]string{"id": rm.ID})
}

func (h *Handler) getRoom(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := h.store.Get(id); !ok {
		logger.Debug("[api] GET /api/rooms/%s: not found", id)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	logger.Debug("[api] GET /api/rooms/%s: ok", id)
	writeJSON(w, http.StatusOK, map[string]string{})
}

func (h *Handler) deleteRoom(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	rm, ok := h.store.Get(id)
	if !ok {
		logger.Debug("[api] DELETE /api/rooms/%s: not found", id)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	hub, hasHub := h.registry.Get(id)

	rm.StopCloseTimer()
	// Remove from store and registry first so new WS connections are rejected immediately.
	h.store.Delete(id)
	h.registry.Delete(id)

	if hasHub {
		hub.Shutdown()
	}
	logger.Debug("[api] DELETE /api/rooms/%s: deleted (hub present: %v)", id, hasHub)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) handleWS(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("roomId")
	ip := clientIP(r)
	if _, ok := h.store.Get(roomID); !ok {
		logger.Debug("[api] WS /ws/%s from %s: room not found", roomID, ip)
		http.Error(w, "room not found", http.StatusNotFound)
		return
	}
	hub, ok := h.registry.Get(roomID)
	if !ok {
		logger.Debug("[api] WS /ws/%s from %s: hub not found", roomID, ip)
		http.Error(w, "room not found", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[api] WS /ws/%s from %s: upgrade error: %v", roomID, ip, err)
		return
	}
	logger.Debug("[api] WS /ws/%s from %s: upgraded, registering client", roomID, ip)

	client := ws.NewClient(conn, hub)
	hub.Register(client)
}
