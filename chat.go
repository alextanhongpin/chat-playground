package main

import (
	"fmt"

	"go.uber.org/zap"
)

type Chat struct {
	users      map[string]*connection
	stream     chan Message
	register   chan *connection
	unregister chan *connection
	quit       chan struct{}
	rooms      *Rooms
	log        *zap.Logger
}

func NewChat() *Chat {
	log, err := zap.NewProduction()
	if err != nil {
		log.Fatal(err.Error())
	}
	defer log.Sync()
	chat := Chat{
		users:      make(map[string]*connection),
		stream:     make(chan Message, 10000),
		register:   make(chan *connection, 10000),
		unregister: make(chan *connection, 10000),
		quit:       make(chan struct{}),
		rooms:      NewRooms(),
		log:        log,
	}
	go chat.loop()
	return &chat
}

func (c *Chat) loop() {
	for {
		select {
		case <-c.quit:
			return
		case conn, ok := <-c.register:
			if !ok {
				return
			}
			c.stream <- Message{
				Type:        "presence",
				Room:        conn.room,
				Text:        "online",
				Sender:      conn.id,
				DisplayName: conn.user,
			}
			c.users[conn.id] = conn
			c.rooms.Add(conn.id, conn.room)
		case conn, ok := <-c.unregister:
			if !ok {
				return
			}
			delete(c.users, conn.id)
			c.rooms.Remove(conn.id)
			c.stream <- Message{
				Type:        "presence",
				Room:        conn.room,
				Text:        "offline",
				Sender:      conn.id,
				DisplayName: conn.user,
			}
			conn.conn.Close()
		case msg, ok := <-c.stream:
			if !ok {
				return
			}
			switch msg.Type {
			case "presence":
				// Send details on who is online/offline to yourself.
				self := c.users[msg.Sender]
				c.log.Info("notifying presence",
					zap.String("sender", msg.Sender),
					zap.Bool("isnil", self == nil),
				)

				// Notify others in the same room.
				users := c.rooms.GetUsers(msg.Room)
				for _, user := range users {
					// Skip if it is the sender.
					if user == msg.Sender {
						continue
					}

					if socket, online := c.users[user]; online {
						c.log.Info("presence for", zap.String("user", user),
							zap.String("curr", msg.Sender))
						err := socket.conn.WriteJSON(msg)
						if err != nil {
							c.unregister <- socket
						}
						if self != nil {
							copy := msg
							copy.DisplayName = socket.user
							copy.Sender = socket.id
							err = self.conn.WriteJSON(copy)
							if err != nil {
								c.unregister <- self
							}
						}
					}
				}
			case "message":
				users := c.rooms.GetUsers(msg.Room)
				for _, user := range users {
					if socket, online := c.users[user]; online {
						err := socket.conn.WriteJSON(msg)
						if err != nil {
							c.unregister <- socket
						}
					}
				}
			case "auth":
				socket := c.users[msg.Sender]
				// msg.DisplayName = socket.user
				// msg.Sender = socket.id
				err := socket.conn.WriteJSON(msg)
				if err != nil {
					c.unregister <- socket
				}

			default:
			}
			fmt.Println(msg)
		}
	}
}
