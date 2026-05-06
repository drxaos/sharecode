package room

import (
	"errors"
	"sync"

	"github.com/google/uuid"
)

const maxRoomsPerIP = 100

var ErrTooManyRooms = errors.New("too many rooms")

type Store struct {
	rooms    map[string]*Room
	roomIP   map[string]string // roomID -> creator IP
	ipCounts map[string]int    // IP -> active room count
	mu       sync.RWMutex
}

func NewStore() *Store {
	return &Store{
		rooms:    make(map[string]*Room),
		roomIP:   make(map[string]string),
		ipCounts: make(map[string]int),
	}
}

func (s *Store) Create(ip string) (*Room, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ipCounts[ip] >= maxRoomsPerIP {
		return nil, ErrTooManyRooms
	}
	r := New(uuid.New().String())
	s.rooms[r.ID] = r
	s.roomIP[r.ID] = ip
	s.ipCounts[ip]++
	return r, nil
}

func (s *Store) Get(id string) (*Room, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.rooms[id]
	return r, ok
}

func (s *Store) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if ip, ok := s.roomIP[id]; ok {
		s.ipCounts[ip]--
		if s.ipCounts[ip] <= 0 {
			delete(s.ipCounts, ip)
		}
		delete(s.roomIP, id)
	}
	delete(s.rooms, id)
}

func (s *Store) ActiveCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.rooms)
}
