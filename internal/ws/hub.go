package ws

import (
	"sync"
	"time"

	"sharecode/internal/logger"
	"sharecode/internal/room"
)

type envelope struct {
	sender *Client
	data   []byte
}

type Hub struct {
	roomID     string
	store      *room.Store
	registry   *Registry
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan *envelope
	shutdown   chan struct{}
	done       chan struct{}
	stopOnce   sync.Once
}

func NewHub(roomID string, store *room.Store, registry *Registry) *Hub {
	return &Hub{
		roomID:     roomID,
		store:      store,
		registry:   registry,
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *envelope, 256),
		shutdown:   make(chan struct{}),
		done:       make(chan struct{}),
	}
}

func (h *Hub) stop() {
	h.stopOnce.Do(func() { close(h.done) })
}

func (h *Hub) Run() {
	logger.Debug("[hub:%s] started", h.roomID)
	defer func() {
		h.stop()
		logger.Debug("[hub:%s] stopped", h.roomID)
	}()
	for {
		select {
		case c := <-h.register:
			h.handleRegister(c)
		case c := <-h.unregister:
			h.handleUnregister(c)
		case env := <-h.broadcast:
			h.handleMessage(env.sender, env.data)
		case <-h.shutdown:
			logger.Debug("[hub:%s] shutdown: closing %d client(s)", h.roomID, len(h.clients))
			for c := range h.clients {
				c.CloseWithCode(1001, "room closed")
				close(c.send)
			}
			h.clients = nil
			return
		}
	}
}

// Shutdown signals the hub to close all clients and stop its Run goroutine.
func (h *Hub) Shutdown() {
	close(h.shutdown)
}

// Register enqueues a client for registration. The hub's Run goroutine will handle
// the initial sync and start the client's read/write pumps.
func (h *Hub) Register(c *Client) {
	h.register <- c
}

func (h *Hub) handleRegister(c *Client) {
	r, ok := h.store.Get(h.roomID)
	if !ok {
		logger.Debug("[hub:%s] register: room gone, dropping %s", h.roomID, c.conn.RemoteAddr())
		return
	}
	r.StopCloseTimer()
	h.clients[c] = true
	updates := r.GetUpdates()
	logger.Debug("[hub:%s] + client %s joined (total: %d), replaying %d update(s)", h.roomID, c.conn.RemoteAddr(), len(h.clients), len(updates))

	// Push all accumulated updates to the new client as syncStep2 messages so it catches up,
	// then send an empty syncStep2 to mark the sync as complete (sets provider.synced).
	for _, u := range updates {
		c.Send(asSyncStep2(u))
	}
	c.Send(emptySyncStep2())
	logger.Debug("[hub:%s] → %s: replay done, sent emptySyncStep2", h.roomID, c.conn.RemoteAddr())

	go c.WritePump()
	go c.ReadPump()
}

func (h *Hub) handleUnregister(c *Client) {
	if !h.clients[c] {
		return
	}
	delete(h.clients, c)
	close(c.send)
	logger.Debug("[hub:%s] - client %s left (remaining: %d)", h.roomID, c.conn.RemoteAddr(), len(h.clients))

	if len(h.clients) == 0 {
		r, ok := h.store.Get(h.roomID)
		if !ok {
			return
		}
		logger.Debug("[hub:%s] room empty, starting 5-min close timer", h.roomID)
		r.StartCloseTimer(5*time.Minute, func() {
			logger.Debug("[hub:%s] close timer fired, deleting room", h.roomID)
			h.store.Delete(h.roomID)
			h.registry.Delete(h.roomID)
			h.stop()
		})
	}
}

func (h *Hub) handleMessage(sender *Client, data []byte) {
	if len(data) == 0 {
		return
	}
	r, ok := h.store.Get(h.roomID)
	if !ok {
		return
	}

	switch data[0] {
	case 0: // messageSync
		if len(data) < 2 {
			return
		}
		switch data[1] {
		case 0: // syncStep1 — reply with all accumulated updates as syncStep2, then empty syncStep2
			updates := r.GetUpdates()
			logger.Debug("[hub:%s] ← %s: syncStep1, replying with %d update(s) as syncStep2", h.roomID, sender.conn.RemoteAddr(), len(updates))
			for _, u := range updates {
				sender.Send(asSyncStep2(u))
			}
			sender.Send(emptySyncStep2())
		case 2: // update — store and fan out to others
			others := len(h.clients) - 1
			logger.Debug("[hub:%s] ← %s: doc update (%d bytes), storing + broadcasting to %d other(s)", h.roomID, sender.conn.RemoteAddr(), len(data), others)
			r.AppendUpdate(data)
			h.broadcastOthers(sender, data)
		}
	case 1: // messageAwareness — forward cursors/selections to all other clients
		others := len(h.clients) - 1
		logger.Debug("[hub:%s] ← %s: awareness (%d bytes), forwarding to %d other(s)", h.roomID, sender.conn.RemoteAddr(), len(data), others)
		h.broadcastOthers(sender, data)
	}
}

func (h *Hub) broadcastOthers(sender *Client, data []byte) {
	for c := range h.clients {
		if c != sender {
			c.Send(data)
		}
	}
}

// emptySyncStep2 encodes [messageSync=0, syncStep2=1, varUint8Array([0,0])]
// where [0,0] is a valid empty Yjs V1 update (0 client structs, 0 delete-set entries).
// Receiving this causes the y-websocket provider to set synced = true.
func emptySyncStep2() []byte {
	return []byte{0, 1, 2, 0, 0}
}

// asSyncStep2 repackages a stored [0, 2, data...] update message as [0, 1, data...]
// (messageSync + syncStep2 subtype) so initial sync and syncStep1 replies conform to the
// y-websocket protocol rather than sending raw update frames.
func asSyncStep2(u []byte) []byte {
	if len(u) >= 2 && u[0] == 0 && u[1] == 2 {
		msg := make([]byte, len(u))
		copy(msg, u)
		msg[1] = 1
		return msg
	}
	return u
}
