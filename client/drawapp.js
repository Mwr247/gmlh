class Point {
  constructor(type, x, y, size, color) {
    this.type = type
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
    
    history = [];
    clients = {};
    room = null;
    localId = null;
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
            this.marker(localStorage.getItem('drawColor') || '#' + (Math.random() * 16777215 | 0).toString(16).padStart(6, '0'), this.host ? 8 : 6);
            this.run();
            if (cb) {cb();}
        }).on('draw', data => {
            this.history.push([data[0], new Point(data[1].type, data[1].x, data[1].y, data[1].size, data[1].color)]);
            this.draw(data);
        }).on('joined', (client, owner, clients) => {
            if (client === this.localId) {
              this.clients = {};
              clients.forEach(clientId => this.clients[clientId] = {type: 2, x: 0, y: 0});
              this.history = [];
              this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            } else {
              this.clients[client] = {type: 2, x: 0, y: 0};
            }
        }).on('left', (client) => {
            if (client === this.localId) {
              this.clients = {};
              this.history = [];
              this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            } else {
              delete this.clients[client];
            }
        });
        
        this.canvas.addEventListener('mousedown', event => this.input(event));
        this.canvas.addEventListener('mousemove', event => this.input(event));
        this.canvas.addEventListener('mouseup', event => this.input(event));
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
        if (point.type === 0 && this.clients[client].type != null) {
            this.ctx.beginPath();
            this.ctx.moveTo((this.clients[client].x + this.offset.x) * this.offset.scale, (this.clients[client].y + this.offset.y) * this.offset.scale);
            this.ctx.lineTo((x + this.offset.x) * this.offset.scale, (y + this.offset.y) * this.offset.scale);
            this.ctx.stroke();
        }
        if (this.clients[client] != null) {
          this.clients[client].type = point.type;
          this.clients[client].x = x;
          this.clients[client].y = y;
        }
        this.ctx.globalAlpha = 1;
    }

    drawHistory(history) {
        Object.values(this.clients).forEach(client => {
           client.type = null;
        });
        history.forEach(data => {
            this.draw(data);
        });
    }

    input(e) {
        if (/^mouse/.test(e.type)) {e.preventDefault();}
        if (e.type === 'mousemove' && e.buttons !== 1) {return;}
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
        let point = new Point(type, x / this.offset.scale - this.offsetX - this.offset.x, y / this.offset.scale - this.offsetY - this.offset.y, this.markerSize, this.markerColor)
        this.history.push([this.localId, point]);
        this.socket.emit('draw', point);
    }
    
    marker(color, size = 8) {
        this.ctx.strokeStyle = this.ctx.fillStyle = this.markerColor = color;
        this.ctx.lineWidth = this.markerSize = size;
        localStorage.setItem('drawColor', color);
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