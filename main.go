package main

import (
	"fmt"
	"html/template"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/julienschmidt/httprouter"
	"github.com/rs/xid"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// CheckOrigin: func(r *http.Request) bool {
	//         return r.Header.Get("Origin") != "http://"+r.Host
	// },
}

type Message struct {
	Text        string    `json:"text,omitempty"`
	Type        string    `json:"type,omitempty"`
	Room        string    `json:"room,omitempty"`
	Sender      string    `json:"sender,omitempty"`
	DisplayName string    `json:"display_name,omitempty"`
	ID          string    `json:"id,omitempty"`
	Date        time.Time `json:"date,omitempty"`
}

type connection struct {
	conn *websocket.Conn
	user string // username, e.g. john
	room string // unique room identifier
	id   string // unique user identifier
}

type Token struct {
	ID string
}

func main() {
	port := ":8000"

	chat := NewChat()
	tmpl := template.Must(template.ParseFiles("templates/index.html"))
	handler := httprouter.New()
	handler.GET("/ws", serveWS(chat))

	handler.ServeFiles("/public/*filepath", http.Dir("public"))
	handler.GET("/", func(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
		tmpl.Execute(w, nil)
	})

	handler.GET("/lobby", func(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
		http.Redirect(w, r, fmt.Sprintf("/rooms/%s", xid.New().String()), http.StatusFound)
	})

	handler.GET("/rooms/:id", func(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
		_, err := xid.FromString(ps.ByName("id"))
		if err != nil {
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		tmpl.Execute(w, Token{ID: ps.ByName("id")})
	})

	// TODO: Add graceful shutdown.
	log.Printf("listening to port *%s. press ctrl + c to cancel.\n", port)
	s := &http.Server{
		Addr:           port,
		Handler:        handler,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	log.Fatal(s.ListenAndServe())
}

func serveWS(chat *Chat) httprouter.Handle {
	return func(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		// This allow us to have same username.
		room := r.URL.Query().Get("room")
		user := r.URL.Query().Get("user")
		// The id can be stored on the client side. This allows us to
		// survive restarts (User rejoining a session should not have a
		// new id).
		id := r.URL.Query().Get("id")
		_, err := xid.FromString(id)
		if err != nil {
			id = xid.New().String()
		}
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		defer ws.Close()

		conn := &connection{
			user: user,
			conn: ws,
			room: room,
			id:   id,
		}

		chat.register <- conn
		defer func() {
			chat.unregister <- conn
		}()

		for {
			var msg Message
			err := ws.ReadJSON(&msg)
			if err != nil {
				log.Printf("error: %v\n", err)
				return
			}
			// The following should be generated from the server-side.
			msg.DisplayName = user
			msg.Sender = id
			msg.Room = room
			msg.ID = xid.New().String()
			msg.Date = time.Now()
			chat.stream <- msg
		}
	}
}
