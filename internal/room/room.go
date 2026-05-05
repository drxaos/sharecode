package room

import (
	"sync"
	"time"
)

type Room struct {
	ID         string
	Updates    [][]byte
	CloseTimer *time.Timer
	mu         sync.Mutex
}

func New(id string) *Room {
	return &Room{
		ID:      id,
		Updates: [][]byte{},
	}
}

func (r *Room) AppendUpdate(data []byte) {
	cp := make([]byte, len(data))
	copy(cp, data)
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Updates = append(r.Updates, cp)
}

func (r *Room) GetUpdates() [][]byte {
	r.mu.Lock()
	defer r.mu.Unlock()
	result := make([][]byte, len(r.Updates))
	copy(result, r.Updates)
	return result
}

func (r *Room) StartCloseTimer(d time.Duration, fn func()) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.CloseTimer != nil {
		r.CloseTimer.Stop()
	}
	r.CloseTimer = time.AfterFunc(d, fn)
}

// StopCloseTimer stops and clears the close timer. Returns true if it was stopped before firing.
func (r *Room) StopCloseTimer() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.CloseTimer == nil {
		return false
	}
	stopped := r.CloseTimer.Stop()
	r.CloseTimer = nil
	return stopped
}
