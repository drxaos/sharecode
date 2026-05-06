package ws

import (
	"log"
	"time"

	"github.com/gorilla/websocket"

	"sharecode/internal/logger"
)

const (
	writeWait   = 10 * time.Second
	pongWait    = 60 * time.Second
	pingPeriod  = (pongWait * 9) / 10
	sendBufSize = 256
)

type Client struct {
	conn *websocket.Conn
	send chan []byte
	hub  *Hub
}

// NewClient creates a Client wrapping the given gorilla WebSocket connection.
func NewClient(conn *websocket.Conn, hub *Hub) *Client {
	return &Client{
		conn: conn,
		send: make(chan []byte, sendBufSize),
		hub:  hub,
	}
}

func (c *Client) Send(data []byte) {
	cp := make([]byte, len(data))
	copy(cp, data)
	select {
	case c.send <- cp:
	default:
		logger.Debug("[client:%s] send buffer full, dropping %d-byte message", c.conn.RemoteAddr(), len(data))
	}
}

func (c *Client) CloseWithCode(code int, msg string) {
	_ = c.conn.WriteMessage(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(code, msg),
	)
	_ = c.conn.Close()
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	logger.Debug("[client:%s] write pump started", c.conn.RemoteAddr())
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
		logger.Debug("[client:%s] write pump stopped", c.conn.RemoteAddr())
	}()
	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			logger.Debug("[client:%s] → %d bytes", c.conn.RemoteAddr(), len(msg))
			if err := c.conn.WriteMessage(websocket.BinaryMessage, msg); err != nil {
				log.Printf("[client:%s] write error: %v", c.conn.RemoteAddr(), err)
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			logger.Debug("[client:%s] → ping", c.conn.RemoteAddr())
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("[client:%s] ping error: %v", c.conn.RemoteAddr(), err)
				return
			}
		}
	}
}

func (c *Client) ReadPump() {
	logger.Debug("[client:%s] read pump started", c.conn.RemoteAddr())
	defer func() {
		logger.Debug("[client:%s] disconnected, unregistering", c.conn.RemoteAddr())
		select {
		case c.hub.unregister <- c:
		case <-c.hub.done:
		}
		_ = c.conn.Close()
	}()
	c.conn.SetReadLimit(2 * 1024 * 1024)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		logger.Debug("[client:%s] ← pong", c.conn.RemoteAddr())
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})
	for {
		_, msg, err := c.conn.ReadMessage()
		if err != nil {
			log.Printf("[client:%s] read error: %v", c.conn.RemoteAddr(), err)
			break
		}
		logger.Debug("[client:%s] ← %d bytes", c.conn.RemoteAddr(), len(msg))
		select {
		case c.hub.broadcast <- &envelope{sender: c, data: msg}:
		default:
			logger.Debug("[client:%s] broadcast buffer full, dropping message", c.conn.RemoteAddr())
		}
	}
}
