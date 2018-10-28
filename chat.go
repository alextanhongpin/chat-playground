package main

import (
	"fmt"
	"log"
)

type Chat struct {
	users      map[string]*connection
	stream     chan Message
	register   chan *connection
	unregister chan *connection
	quit       chan struct{}
	rooms      *Rooms
}

func NewChat() *Chat {
	chat := Chat{
		users:      make(map[string]*connection),
		stream:     make(chan Message, 10000),
		register:   make(chan *connection, 10000),
		unregister: make(chan *connection, 10000),
		quit:       make(chan struct{}),
		rooms:      NewRooms(),
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
		case msg, ok := <-c.stream:
			if !ok {
				return
			}
			switch msg.Type {
			case "presence":
				users := c.rooms.GetUsers(msg.Room)
				for _, user := range users {
					if user == msg.Sender {
						// Don't send to yourself.
						continue
					}
					if socket, online := c.users[user]; online {
						msg.DisplayName = socket.user
						err := socket.conn.WriteJSON(msg)
						if err != nil {
							socket.conn.Close()
							c.unregister <- socket
						}
					}
				}
			case "message":
				users := c.rooms.GetUsers(msg.Room)
				for _, user := range users {
					if socket, online := c.users[user]; online {
						err := socket.conn.WriteJSON(msg)
						if err != nil {
							socket.conn.Close()
							c.unregister <- socket
						}
					}
				}
			case "auth":
				socket := c.users[msg.Sender]
				msg.DisplayName = socket.user
				msg.Sender = socket.id
				err := socket.conn.WriteJSON(msg)
				if err != nil {
					socket.conn.Close()
					c.unregister <- socket
				}
			case "status":
				// Find everyone in the same room to get their status.
				users := c.rooms.GetUsers(msg.Room)
				sender := c.users[msg.Sender]
				log.Println("checking statuses", users)
				for _, user := range users {
					if user == msg.Sender {
						// Don't need to notify oneself.
						continue
					}
					if conn, exist := c.users[user]; exist {
						log.Println("sending presence indicator")
						err := sender.conn.WriteJSON(Message{
							Type:        "presence",
							Text:        "online",
							Sender:      conn.id,
							DisplayName: conn.user,
							Room:        conn.room,
						})
						if err != nil {
							conn.conn.Close()
							c.unregister <- conn
						}
					}
				}

			default:
			}
			fmt.Println(msg)
		}
	}
}
