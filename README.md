# chat-playground

A stateless chat app that is inspired by play.golang, with sharable links for others to join the room. Once all users leave the room, the room and the messages will be deleted.

## Requirements

Functional requirements:
- System should allow users to chat with another user
- System should store the conversations of the users
- System should notify users when another user join the group
- System should tolerate refresh from frontend

Non-functional requirements:
- System should be stateful (no database, just in-memory)

Extended requirements:
- Should encrypt conversations (e.g. with Signal Protocol)
- Should notify users when another user is typing 
- Should send notification to user that is offline
- Should allow users to upload files

## Capacity Estimation and Constraints

We can easily interpolate the results by just taking a base estimate of 100 msg/second and msg size of 72 bytes (can be estimated by taking the `unsafe.Sizeof(msgStruct)`). 

Amount:
```
1 second = 100 msgs
1 month = 259,200,000 msgs (259.2M)
```

Traffic Read/Write:
```
read:write ratio = 100:1
10,000 msg/s : 100 msg/s
```

Storage:
```
Not required, as everything is in-memory
```

Bandwidth:
```
read:write ratio = 100:1
write: 7KB/s
read: 0.7MB/s
```

Memory:
```
Persisted for one day
100 * 86400 * 72 bytes ~= 595MB
```
