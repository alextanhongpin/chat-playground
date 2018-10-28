package main

import (
	"log"
	"testing"
)

func TestAddUser(t *testing.T) {
	rooms := NewRooms()
	rooms.Add("john", "room1")
	rooms.Add("john", "room2")

	if res := rooms.GetUsers("room1"); res[0] != "john" {
		t.Fatal("invalid user")
	}
	res := rooms.GetRooms("john")
	log.Println(res)
	if len(res) != 2 {
		t.Fatalf("want %v, got %v", 2, len(res))
	}
	isRoom1 := res[0] == "room1" || res[1] == "room1"
	isRoom2 := res[0] == "room2" || res[1] == "room2"
	if !isRoom1 || !isRoom2 {
		t.Fatal("not in correct room")
	}
}
