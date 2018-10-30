package main

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
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

type Health struct {
	BuildDate  string `json:"build_date"`
	Version    string `json:"version"`
	DeployedAt string `json:"deployed_at"`
	Uptime     string `json:"uptime"`
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
	var (
		port       = ":8000"
		buildDate  = os.Getenv("BUILD_DATE")
		version    = os.Getenv("VERSION")
		deployedAt = time.Now().UTC().Format(time.RFC3339)
		uptime     = time.Now()
	)

	chat := NewChat()
	tmpl := template.Must(template.ParseFiles("templates/index.html"))
	handler := httprouter.New()
	handler.GET("/ws", serveWS(chat))

	handler.ServeFiles("/public/*filepath", http.Dir("public"))
	handler.GET("/health", func(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
		json.NewEncoder(w).Encode(Health{
			BuildDate:  buildDate,
			Version:    version,
			DeployedAt: deployedAt,
			Uptime:     time.Since(uptime).String(),
		})
	})
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

	srv := &http.Server{
		Addr:           port,
		Handler:        handler,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	quit := make(chan os.Signal, 1)
	signal.Notify(quit,
		syscall.SIGHUP,
		syscall.SIGINT,
		syscall.SIGTERM,
		syscall.SIGQUIT)

	go func() {
		log.Printf("listening to port *%s. press ctrl + c to cancel.\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	<-quit
	log.Println("main: server terminating...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("error: %v", err)
	}
	log.Println("main: graceful shutdown")
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
