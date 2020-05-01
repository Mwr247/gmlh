class Client {
    constructor(name = '', point = new Point()) {
        this.name = name;
        this.point = point
    }
};

class Point {
    constructor(type = 2, x = 0, y = 0, size = 0, color = '#000000') {
        this.type = type;
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.time = Date.now();
    }
};

export class DrawApp {
    url = null;
    host = false;
    socket = null;
    canvas = null;
    ctx = null;
    
    tableCanvas = null;
    tableCtx = null;
    cursors = null;
    
    history = [];
    clients = {};
    owner = null;
    room = null;
    localId = null;
    localName = '';
    cutoff = 2000;
    resizeTimeout = null;
    
    offset = {
        x: 0,
        y: 0,
        scale: 1
    };
    drag = {
        x: 0,
        y: 0
    };
    
    constructor(url, host) {
        this.url = url;
        this.host = host === true;
    }
  
    init(elementId, cb) {
        if (io == null) {throw new Error('DrawApp: socket.io not detected');}
        this.socket = io.connect(this.url, {transports: ['websocket'], upgrade: false});
        this.canvas = document.getElementById(elementId);
        if (this.canvas == null) {throw new Error('DrawApp: canvas element "' + elementId + '" not detected');}
        this.cursors = document.getElementById('cursors');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.fillStyle = 'solid';
        setTimeout(() => this.resize(), 60);
      
        this.socket.on('connect', data => {
            this.localId = this.socket.id;
            this.history = [];
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.room = new URLSearchParams(window.location.search).get('table') || 'gmlh';
            if (this.room != null) {
                this.socket.emit(this.host ? 'create' : 'join', this.room);
            }
            if (!this.host) {
                this.name(localStorage.getItem('drawName') || 'Player ' + ((Math.random() * 999) | 0) + 1);
            }
            this.marker(localStorage.getItem('drawColor') || '#' + (Math.random() * 16777215 | 0).toString(16).padStart(6, '0'), this.host ? 8 : 6);
            this.run();
            if (cb) {cb();}
        }).on('joined', (clientId, owner, clients) => {
            if (clientId === this.localId) {
                this.clients = {};
                clients.forEach(clientId2 => {
                    this.clients[clientId2] = new Client();
                    this.createCursor(clientId2);
                });
                this.history = [];
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            } else {
                this.clients[clientId] = new Client();
                this.createCursor(clientId);
            }
            this.owner = owner;
        }).on('left', (clientId) => {
            if (clientId === this.localId) {
                this.clients.forEach(clientId => {
                    this.deleteCursor(clientId);
                });
                this.clients = {};
                this.history = [];
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            } else {
                if (clientId === this.owner) {this.owner = null;}
                this.deleteCursor(clientId);
                delete this.clients[clientId];
            }
        }).on('name', (clientId, name) => {
            this.clients[clientId].name = name;
        }).on('cursor', (clientId, point) => {
            this.clients[clientId].point = new Point(point.type, point.x, point.y, point.size, point.color);
            this.updateCursor(clientId);
        }).on('draw', (clientId, point) => {
            this.history.push([clientId, new Point(point.type, point.x, point.y, point.size, point.color)]);
            this.draw([clientId, point]);
        });
        
        this.canvas.addEventListener('mousedown', event => this.input(event));
        this.canvas.addEventListener('mousemove', event => this.input(event));
        document.addEventListener('mouseup', event => this.input(event));
        this.canvas.addEventListener('touchstart', event => this.input(event));
        this.canvas.addEventListener('touchmove', event => this.input(event));
        this.canvas.addEventListener('touchend', event => this.input(event));
        //document.addEventListener('contextmenu', event => event.preventDefault());
        //document.addEventListener('wheel', event => event.preventDefault());
        window.addEventListener('resize', event => this.resizeThrottler(event));
        
        return this;
    }
    
    tableHook() {
        return (data, cb) => {
            if (!this.host || !this.socket) {return false;}
            this.socket.emit('table', data, status => {
                cb(status);
            });
        };
    };
    
    playerInit(elementId) {
        if (this.host || !this.socket) {return false;}
        this.tableCanvas = document.getElementById(elementId);
        if (this.tableCanvas == null) {throw new Error('DrawApp: canvas element "' + elementId + '" not detected');}
        this.tableCanvas.style.display = 'block';
        this.tableCtx = this.tableCanvas.getContext('2d');
        setTimeout(() => this.socket.emit('table'));
        this.socket.on('table', data => {
            if (data && data.img) {
                const img = new Image();
                img.src = data.img;
                const offsetX = (this.tableCanvas.width - data.width) / 2;
                const offsetY = (this.tableCanvas.height - data.height) / 2
                img.onload = () => {
                  this.tableCtx.clearRect(0, 0, this.tableCanvas.width, this.tableCanvas.height);
                  this.tableCtx.drawImage(img, offsetX, offsetY);
                };
            }
        });
        
        return this;
    };
    
    run() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const cutoff = Date.now() - this.cutoff;
        this.history = this.history.filter(line => line[1].time > cutoff);
        this.drawHistory(this.history);
        requestAnimationFrame(this.run.bind(this));
    }
    
    draw(data) {
        let client = data[0];
        if (this.clients[client] == null) {return;}
        let point = data[1];
        let x = point.x + this.offsetX, y = point.y + this.offsetY;
        this.ctx.lineWidth = point.size * this.offset.scale;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = this.ctx.fillStyle = point.color;
        let size = point.size - 1;
        this.ctx.globalAlpha = Math.min(Math.max((point.time - (Date.now() - this.cutoff)) / 500, 0), 1);
        if (point.type === 0 && this.clients[client].point.type != null) {
            this.ctx.beginPath();
            this.ctx.moveTo((this.clients[client].point.x + this.offset.x) * this.offset.scale, (this.clients[client].point.y + this.offset.y) * this.offset.scale);
            this.ctx.lineTo((x + this.offset.x) * this.offset.scale, (y + this.offset.y) * this.offset.scale);
            this.ctx.stroke();
        }
        if (this.clients[client] != null) {
          this.clients[client].point = new Point(point.type, x, y, point.size, point.color);
        }
        this.ctx.globalAlpha = 1;
    }

    drawHistory(history) {
        Object.values(this.clients).forEach(client => {
           client.point.type = null;
        });
        history.forEach(data => {
            this.draw(data);
        });
    }

    input(e) {
        if (/^mouse/.test(e.type)) {e.preventDefault();}
        if (e.touches != null && e.touches.length) {
          e.x = e.touches[0].clientX;
          e.y = e.touches[0].clientY;
        }
        let x = e.x, y = e.y;
        if (e.buttons === 2 || (e.touches != null && e.touches.length === 2)) {
            return false;
            //if (/down$/.test(e.type)) {
            //    this.drag.x = x / this.offset.scale - this.offset.x;
            //    this.drag.y = y / this.offset.scale - this.offset.y;
            //} else {
            //    this.offset.x = x / this.offset.scale - this.drag.x;
            //    this.offset.y = y / this.offset.scale - this.drag.y;
            //    this.resizeThrottler();
            //}
            //return;
        }
        let type;
        if (/move$/.test(e.type)) {type = 0;}
        else if (/down$|start$/.test(e.type)) {type = 1;}
        else if (/up$|end$/.test(e.type)) {type = 2;}
        else {return false;}
        let point = new Point(type, x / this.offset.scale - this.offsetX - this.offset.x, y / this.offset.scale - this.offsetY - this.offset.y, this.markerSize, this.markerColor);
        this.socket.emit('cursor', point);
        this.updateCursor(this.localId, point);
        if (e.type === 'mousemove' && e.buttons !== 1) {return;}
        this.history.push([this.localId, point]);
        this.socket.emit('draw', point);
    }

    name(name = '') {
        name = name.replace(/[^-_ A-Za-z0-9]/gi, '').slice(0, 32);
        this.localName = name;
        localStorage.setItem('drawName', name);
        this.socket.emit('name', name);
    }
    
    marker(color, size = 8) {
        this.ctx.strokeStyle = this.ctx.fillStyle = this.markerColor = color;
        this.ctx.lineWidth = this.markerSize = size;
        localStorage.setItem('drawColor', color);
    }

    createCursor(clientId) {
        const cursor = document.createElement('div');
        cursor.id = 'cursor_' + clientId;
        const client = this.clients[clientId];
        cursor.style.backgroundColor = client.point.color;
        cursor.style.left = (client.point.x + this.offsetX - 1) + 'px';
        cursor.style.top = (client.point.y + this.offsetY - 1) + 'px';
        const cursorName = document.createElement('div');
        cursorName.id = 'cursorName_' + clientId;
        cursorName.innerHTML = clientId === this.owner ? '(DM)' : client.name;
        cursorName.style.top = (-client.point.size * 2 - 4) + 'px';
        cursorName.style.right = -client.point.size + 'px';
        if (clientId === this.localId) {
            cursorName.style.display = 'none';
        }
        cursor.appendChild(cursorName);
        this.cursors.appendChild(cursor);
    }

    updateCursor(clientId, point = this.clients[clientId].point) {
        const cursor = document.getElementById('cursor_' + clientId);
        if (cursor != null) {
            const client = this.clients[clientId];
            cursor.style.backgroundColor = point.color;
            cursor.style.left = (point.x + this.offsetX - 1) - point.size / 2 + 'px';
            cursor.style.top = (point.y + this.offsetY - 1) - point.size / 2 + 'px';
            cursor.style.width = point.size + 'px';
            cursor.style.height = point.size + 'px';
            const cursorName = document.getElementById('cursorName_' + clientId);
            cursorName.innerHTML = clientId === this.owner ? this.localId === this.owner ? '' : '(DM)' : client.name;
            cursorName.style.top = (-point.size * 2 - 4) + 'px';
            cursorName.style.right = -point.size + 'px';
            if (point.type === 2) {
                cursor.classList.remove('show');
            } else if (point.type === 1) {
                cursor.classList.add('show');
            }
        }
    }

    deleteCursor(clientId) {
        const cursor = document.getElementById('cursor_' + clientId);
        if (cursor != null) {
            cursors.removeChild(cursor);
        }
    }
    
    resize() {
        this.canvas.width = document.body.clientWidth;
        this.canvas.height = document.body.clientHeight;
        this.offsetX = this.canvas.width / this.offset.scale / 2;
        this.offsetY = this.canvas.height / this.offset.scale / 2;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.tableCanvas) {
            this.tableCanvas.width = document.body.clientWidth;
            this.tableCanvas.height = document.body.clientHeight;
            this.tableCtx.clearRect(0, 0, this.tableCanvas.width, this.tableCanvas.height);
        }
        this.drawHistory(this.history);
    }
    
    resizeThrottler() {
        if (this.resizeTimeout == null) {
            this.resizeTimeout = setTimeout(() => {
                this.resizeTimeout = null;
                this.resize();
            }, 16);
        }
    }
}