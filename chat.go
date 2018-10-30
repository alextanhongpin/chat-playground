package main

import (
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
	messages   map[string][]Message
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
		messages:   make(map[string][]Message),
	}
	go chat.loop()
	return &chat
}

func (c *Chat) loop() {
	log := c.log
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

			// Notify the user that the auth is successfull.
			conn.conn.WriteJSON(Message{
				Type:        "auth",
				Sender:      conn.id,
				Room:        conn.room,
				Text:        "online",
				DisplayName: conn.user,
			})
			// Retrieve all messages from the current room, if any.
			messages, found := c.messages[conn.room]
			if found {
				for _, msg := range messages {
					err := conn.conn.WriteJSON(msg)
					if err != nil {
						continue
					}
				}
			}
		case conn, ok := <-c.unregister:
			if !ok {
				return
			}
			delete(c.users, conn.id)
			isEmpty := c.rooms.Remove(conn.id)
			if isEmpty {
				// Clear all conversations.
				delete(c.messages, conn.room)
			}
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
				log.Info("notifying presence",
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
						log.Info("presence for", zap.String("user", user),
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
				messages, found := c.messages[msg.Room]
				if !found {
					messages = make([]Message, 0)
				}
				messages = append(messages, msg)
				c.messages[msg.Room] = messages
				log.Info("conversations",
					zap.String("room", msg.Room),
					zap.Int("count", len(messages)))
			// case "auth":
			//         socket := c.users[msg.Sender]
			//         err := socket.conn.WriteJSON(msg)
			//         if err != nil {
			//                 c.unregister <- socket
			//         }
			default:
				log.Info("not implemented", zap.String("type", msg.Type))
			}
		}
	}
}
