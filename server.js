require('dotenv').config();

const secure = process.env.KEY && process.env.CERT && process.env.CA;
const port = process.env.PORT || 4000;

const fs = require('fs');
const https = require(secure ? 'https' : 'http');
const url = require('url');
const path = require('path');

const credentials = secure ? {
	key: fs.readFileSync(process.env.KEY, 'utf8'),
	cert: fs.readFileSync(process.env.CERT, 'utf8'),
	ca: fs.readFileSync(process.env.CA, 'utf8')
} : undefined;

const fileTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain'
};

const server = https.createServer(credentials, (req, res) => {
    let pathname = url.parse(req.url).pathname;
    switch (pathname) {
        case '/':
        case '/player': pathname = 'client/index.html';break;
        case '/dm': pathname = 'client/dm.html';break;
        default: pathname = 'client/' + pathname.replace(/^\//, '');
    }
    const ext = path.parse(pathname).ext;
    
    fs.access(pathname, (error) => {
        if (error) {
            res.statusCode = 404;
            res.end('File not found: ' + pathname);
            return;
        }
        fs.readFile(pathname, (err, data) => {
            if (err){
                res.statusCode = 500;
                res.end('Error loading file: ' + err);
            } else {
                res.setHeader('Content-type', fileTypes[ext] || 'text/plain' );
                res.end(data);
            }
        });
    });
});

class Point {
    constructor(type, x, y, size, color) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
    }
};

class Room {
    constructor(id, owner) {
        this.id = id;
        this.owner = owner;
        this.lastTable = null;
        this.lastTableTime = null;
    }
};

const rooms = {};

const io = require('socket.io')(server, {
    handlePreflightRequest: (req, res) => {
        const headers = {
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Origin": req.headers.origin,
            "Access-Control-Allow-Credentials": true
        };
        res.writeHead(200, headers);
        res.end();
    }
}).set('transports', ['websocket']).on('connection', client => {
    console.log(client.id, 'connected');
    
    client.on('create', room => {
        room = String(room);
        if (rooms[room] == null) {
            console.log(client.id, 'created', room);
            rooms[room] = new Room(String(room), client.id);
        } else if (rooms[room].owner == null) {
            console.log(client.id, 'owned', room);
            rooms[room].owner = client.id;
        } else {
            return;
        }
        client.room = room;
        client.join(room);
        io.in(room).clients((err, roomClients) => {
            io.to(room).emit('joined', client.id, rooms[room].owner, roomClients);
        });
    });
    
    client.on('join', room => {
        room = String(room);
        if (rooms[room] == null) {
            rooms[room] = new Room(String(room), null);
            console.log(room, 'created');
        }
        console.log(client.id, 'joined', room);
        client.room = room;
        client.join(room);
        io.in(room).clients((err, roomClients) => {
            io.to(room).emit('joined', client.id, rooms[room].owner, roomClients);
        });
    });

    client.on('draw', data => {
        if (client.room != null) {
            client.to(client.room).emit('draw', [client.id, new Point(data.type, data.x, data.y, data.size, data.color)]);
        }
    });
    
    client.on('table', (data, cb) => {
        if (client.room != null && rooms[client.room] != null) {
            if(rooms[client.room].owner === client.id) {
                if (cb) {cb(1);}
                if (rooms[client.room].lastTableTime >= Date.now()) {return;}
                delete rooms[client.room].lastTable;
                client.to(client.room).emit('table', data);
                rooms[client.room].lastTable = data;
                rooms[client.room].lastTableTime = Date.now() + data.img.length / 2000;
            } else if (rooms[client.room].lastTable != null) {
                client.emit('table', rooms[client.room].lastTable);
            }
        }
    });

    client.on('disconnect', () => {
        console.log(client.id, 'disconnected');
        if (client.room != null && rooms[client.room] != null) {
            let room = client.room;
            console.log(client.id, 'left', room);
            client.to(room).emit('left', client.id);
            if (rooms[room].owner === client.id) {
                console.log(room, 'disowned');
                delete rooms[room].owner;
                delete rooms[room].lastTable;
            }
            io.in(room).clients((err, roomClients) => {
                if (!roomClients.length){
                    console.log(room, 'deleted');
                    delete rooms[room];
                }
            });
        }
    });
});

server.listen(port);
console.log('[GMLH] running on port', port);