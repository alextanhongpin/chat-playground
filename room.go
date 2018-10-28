package main

type roomKey string

type userKey string

type Rooms struct {
	store map[interface{}]map[interface{}]struct{}
}

func NewRooms() *Rooms {
	return &Rooms{
		store: make(map[interface{}]map[interface{}]struct{}),
	}
}

func (r *Rooms) Add(user, room string) {
	if _, found := r.store[userKey(user)]; !found {
		r.store[userKey(user)] = make(map[interface{}]struct{})
	}
	r.store[userKey(user)][roomKey(room)] = struct{}{}
	if _, found := r.store[roomKey(room)]; !found {
		r.store[roomKey(room)] = make(map[interface{}]struct{})
	}
	r.store[roomKey(room)][userKey(user)] = struct{}{}
}

func (r *Rooms) Remove(user string) {
	rooms := r.store[userKey(user)]
	for room := range rooms {
		delete(r.store[room], userKey(user))
	}
	delete(r.store, userKey(user))
}

func (r *Rooms) GetUsers(room string) []string {
	users := r.store[roomKey(room)]
	var result []string
	for user := range users {
		u, ok := user.(userKey)
		if ok {
			result = append(result, string(u))
		}
	}
	return result
}

func (r *Rooms) GetRooms(user string) []string {
	rooms := r.store[userKey(user)]
	var result []string
	for room := range rooms {
		r, ok := room.(roomKey)
		if ok {
			result = append(result, string(r))
		}
	}
	return result
}
