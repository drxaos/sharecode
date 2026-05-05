package ws

import "sync"

type Registry struct {
	hubs map[string]*Hub
	mu   sync.RWMutex
}

func NewRegistry() *Registry {
	return &Registry{hubs: make(map[string]*Hub)}
}

func (r *Registry) Set(id string, h *Hub) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.hubs[id] = h
}

func (r *Registry) Get(id string) (*Hub, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	h, ok := r.hubs[id]
	return h, ok
}

func (r *Registry) Delete(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.hubs, id)
}
