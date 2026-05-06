package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"sharecode/internal/api"
	"sharecode/internal/logger"
	"sharecode/internal/room"
	"sharecode/internal/ws"
)

func main() {
	logger.SetDebug(os.Getenv("DEBUG") == "1")

	store := room.NewStore()
	registry := ws.NewRegistry()

	mux := http.NewServeMux()

	handler := api.NewHandler(store, registry)
	handler.RegisterRoutes(mux)

	distDir := "./frontend/dist"
	fs := http.FileServer(http.Dir(distDir))
	mux.Handle("/", spaHandler{fs: fs, root: distDir})

	addr := ":8080"
	log.Printf("listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

type spaHandler struct {
	fs   http.Handler
	root string
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := filepath.Join(h.root, filepath.Clean("/"+r.URL.Path))
	if _, err := os.Stat(path); os.IsNotExist(err) {
		http.ServeFile(w, r, filepath.Join(h.root, "index.html"))
		return
	}
	h.fs.ServeHTTP(w, r)
}
