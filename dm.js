// GM's Little Helper
// Author: Mwr247 (Prismic)
// Updated:  2020-01-06

function GMLH(width, height) {
    const app = new PIXI.Application({ 
        width: window.innerWidth,   // default: 800
        height: window.innerHeight, // default: 600
        antialias: true,            // default: false
        transparent: false,         // default: false
        resolution: 1,              // default: 1
    });
    app.renderer.backgroundColor = 0xdbd1b4;
    app.renderer.view.style.position = 'absolute';
    app.renderer.view.style.display = 'block';
    app.renderer.autoDensity = true;
    document.body.appendChild(app.view);

    const viewport = new Viewport.Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        worldWidth: width,
        worldHeight: height,
        disableOnContextMenu: true,
        interaction: app.renderer.plugins.interaction
    });
    viewport.pivot.x = 0;
    viewport.pivot.y = 0;
    viewport.x = app.renderer.width / 2 - width / 2;
    viewport.y = app.renderer.height / 2 - height / 2;
    viewport.scaleAmount = 1;
    viewport
    .on('rightdown', onRightDown)
    .on('rightup', onRightUp)
    .on('rightupoutside', onRightUp)
    .on('mousemove', onDragMove)
    .on('touchmove', onDragMove);
    viewport.clamp({
        left: -width * 0.25,
        top: -height * 0.25,
        right: width * 1.25,
        bottom: height * 1.25
    });
    viewport.clampZoom({
        //minWidth: width / 10,
        //minHeight: height / 10,
        //maxWidth: width * 2,
        //maxHeight: height * 2
    });
    app.stage.addChild(viewport);
 
    viewport.drag({
        mouseButtons: 'right',
        wheel: false
    // }).wheel({
    //     percent: 0.01,
    //     smooth: 5
    }).pinch();

    var noClick = true;
    window.addEventListener('dragover', e => e.preventDefault(), false);
    window.addEventListener('drop', fileDrop, false);
    document.addEventListener('wheel', wheelHandler, false);
    document.addEventListener('mousedown', e => noClick && e.preventDefault(), false);
    document.addEventListener('mouseup', e => noClick && e.preventDefault(), false);
    document.addEventListener('click', e => noClick && e.preventDefault(), false);
    document.addEventListener('contextmenu', e => e.preventDefault(), false);
    let view, tile, grid, map;
    let hovered = [], held, selected;
    let ctrl = false, shift = false, streaming = true;
    streamHook = null;
    const context = {
        object: document.getElementById('objectContext'),
        viewport: document.getElementById('viewportContext')
    };
    let selectedContext;
    let begin = document.getElementById('begin');
    let evtPropKill = false;
    let lastImage = Date.now() + 1000;
    let lastHash = '';
    let fastHash = false;
    let waiting = false;

    window.addEventListener('resize', () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
        viewport.screenWidth = window.innerWidth;
        viewport.screenHeight = window.innerHeight;
    }, false);
    history.pushState(null, document.title, location.href);
    window.addEventListener('popstate', event => {
        history.pushState(null, document.title, location.href);
    });

    PIXI.Loader.shared.add([
        'textures/parchment.jpg',
    ]).on('progress', (loader, resource) => {
        console.log('loading:', resource.url);
        console.log('progress:', loader.progress + '%');
    }).load(() => {
        tile = new PIXI.TilingSprite(
            PIXI.Texture.from('textures/parchment.jpg'),
            width,
            height,
        );
        viewport.addChild(tile);

        const rect = new PIXI.Graphics();
        rect.lineStyle(8, 0x000000);
        rect.drawRect(0, 0, width, height);
        tile.addChild(rect);

        view = new PIXI.Container();
        view.interactive = true;
        view.buttonMode = true;
        view.sortableChildren = true;
        view.pivot.x = 0;
        view.pivot.y = 0;
        view.x = width / 2;
        view.y = height / 2;
        view.width = width;
        view.height = height;
        viewport.addChild(view);

        grid = new PIXI.Container();
        grid.interactive = true;
        grid.buttonMode = true;
        grid.pivot.x = 0;
        grid.pivot.y = 0;
        grid.x = 0;
        grid.y = 0;
        grid.zIndex = 51;
        grid.width = width;
        grid.height = height;
        view.addChild(grid);

        const gridLines = new PIXI.Graphics();
        const gridConst = 50;
        const gridScale = width / gridConst;
        for (let i = 0; i < gridScale; i++) {
            let lw = 1;
            /*if (!(i % (gridConst * 2))) {lw = 4;}
            else if (!(i % (gridConst / 2))) {lw = 3;}
            else if (!(i % (gridConst / 10))) {lw = 2;}*/
            gridLines.lineStyle(lw, 0x000000, 0.5);
            gridLines.moveTo(-width / 2, i * gridConst - height / 2);
            gridLines.lineTo(width / 2, i * gridConst - height / 2);
            gridLines.moveTo(i * gridConst - width / 2, -height / 2);
            gridLines.lineTo(i * gridConst - width / 2, height / 2);
            gridLines.endFill();
        }
        grid.addChild(gridLines);

        app.ticker.add(delta => gameLoop(delta));
    });

    function gameLoop(delta) {
    }
    
    function hash(s) {
        return s.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
    }
    
    function render() {
        if (waiting === true && Date.now() > lastImage + 500) {waiting = false;}
        if (streaming && waiting === false && Date.now() > lastImage) {
            const thisHash = hash(app.renderer.view.toDataURL('image/jpeg', 0.01));
            console.log(thisHash === lastHash, fastHash);
            if (thisHash === lastHash) {
                lastImage = Date.now() + 500;
                if (fastHash === true) {
                    fastHash = false;
                    streamHook({img: app.renderer.view.toDataURL('image/jpeg', 0.6), width: app.renderer.width, height: app.renderer.height}, wait);
                    waiting = true;
                }
            } else {
                fastHash = true;
                lastImage = Date.now() + 50;
                streamHook({img: app.renderer.view.toDataURL('image/jpeg', 0.2), width: app.renderer.width, height: app.renderer.height}, wait);
                lastHash = thisHash;
                waiting = true;
            }
        }
        requestAnimationFrame(render);
    }
    
    function wait(status) {
        waiting = false;
    }
    
    function hookStream(hook) {
        if (!streamHook && typeof hook === 'function') {
            streamHook = hook;
            requestAnimationFrame(render);
        }
    }

    function createSprite(path, scale = 1, x = 0, y = 0) {
        let sprite = new PIXI.Sprite(PIXI.Texture.from(path));
        sprite.interactive = true;
        sprite.buttonMode = true;
        sprite.scale.set(scale);
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = y;
        sprite.zIndex = sprite.zIndexDefault = 100;
        sprite.filters = [];
        sprite.locked = false;
        sprite
        .on('mousedown', onDragStart)
        .on('touchstart', onDragStart)
        .on('mouseup', onDragEnd)
        .on('mouseupoutside', onDragEnd)
        .on('touchend', onDragEnd)
        .on('touchendoutside', onDragEnd)
        .on('mousemove', onDragMove)
        .on('touchmove', onDragMove)
        .on('rightdown', onRightDown)
        .on('rightup', onRightUp)
        .on('rightupoutside', onRightUp)
        .on('mouseover', onMouseOver)
        .on('mouseout', onMouseOut);
        return sprite;
    }

    function deleteSprite(sprite) {
        if (!sprite) {return;}
        sprite.parent.removeChild(sprite);
        sprite.destroy({children: true, texture: true, baseTexture: true});
        if (sprite === map) {
            map = null;
            begin.style.display = 'block';
        }
        if (sprite === held) {held = null;}
        if (sprite === selected) {selected = null;}
    };

    function rotateSprite(sprite, angle) {
        if (!sprite) {return;}
        if (angle === 0) {sprite.angle = 0;}
        angle = angle % 360;
        if (angle < 0) {angle += 360;}
        sprite.angle = sprite.angle + angle;
    }

    function zoom(sprite, amount) {
        if (!sprite) {
            if (amount) {
                viewport.scaleAmount *= amount;
            } else {
                viewport.scaleAmount = 1;
            }
            viewport.setZoom(viewport.scaleAmount, true);
            return;
        }
        let scale = sprite.scale.x;
        if (amount) {
            scale *= amount;
        } else {
            scale = 1;
        }
        sprite.scale.set(scale);
    }

    function indexSprite(sprite, amount = 0, save = false) {
        if (!sprite) {return;}
        if (amount) {
            sprite.zIndex += amount;
            if (save) {sprite.zIndexDefault = sprite.zIndex - (sprite === held) * 1000;}
        } else {
            if (save) {sprite.zIndexDefault = 100;}
            sprite.zIndex = sprite.zIndexDefault;
        }
        if (sprite.parent && sprite.parent.children) {
            sprite.parent.children.sort((a, b) => a.zIndex > b.zIndex);
            sprite.parent.updateTransform();
        }
    }

    function getSelected() {return selected;}

    function setSelected(sprite) {
        if (!map) {return;}
        if (selected) {
            removeOutline(selected, 'selected');
        }
        selected = sprite || null;
        if (sprite) {
            //if (sprite !== map) {
                addOutline(sprite, 'selected', 0xFF0000);
            //}
        }
    }

    function addOutline(sprite, type, color = 0x000000) {
        if (!sprite) {return;}
        let filter = new PIXI.filters.OutlineFilter(sprite.width * sprite.scale * map.scale, color);
        filter.type = type;
        sprite.filters.push(filter);
    }

    function removeOutline(sprite, type) {
        if (!sprite) {return;}
        sprite.filters = sprite.filters.filter(filter => filter.type !== type);
    }

    function fileDrop(event) {
        event.preventDefault();
        let dt = event.dataTransfer || {};
        let files = dt.files
        console.log(dt.files);
        if (files) {
            [...files].forEach(file => {
                let img = new Image();
                img.onload = image => {
                    const sprite = createSprite(new PIXI.resources.ImageResource(image.srcElement));
                    if (map) {
                        sprite.x = (((event.clientX - app.renderer.width / 2) / viewport.scaleAmount + (viewport.center.x - width / 2)) - map.x) / map.scale.x;
                        sprite.y = (((event.clientY - app.renderer.height / 2) / viewport.scaleAmount + (viewport.center.y - height / 2)) - map.y) / map.scale.y;
                        if (map.angle === 180) {[sprite.x, sprite.y] = [-sprite.x, -sprite.y];}
                        else if (map.angle === 90) {[sprite.x, sprite.y] = [sprite.y, -sprite.x];}
                        else if (map.angle === 270) {[sprite.x, sprite.y] = [-sprite.y, sprite.x];}
                        sprite.angle = (360 - map.angle) % 360;
                        map.addChild(sprite);
                    } else {
                        sprite.x = ((event.clientX - app.renderer.width / 2) / viewport.scaleAmount + (viewport.center.x - width / 2));
                        sprite.y = ((event.clientY - app.renderer.height / 2) / viewport.scaleAmount + (viewport.center.y - height / 2));
                        sprite.sortableChildren = true;
                        sprite.zIndex = 50;
                        view.addChild(sprite);
                        map = sprite;
                        begin.style.display = 'none';
                    }
                    URL.revokeObjectURL(img.src);
                };
                img.src = URL.createObjectURL(file);
            });
        }
    }

    function displayGrid(display) {
        if (display == null) {
            display = !grid.visible;
        }
        grid.visible = display === true;
    }

    function wheelHandler(event) {
        event.preventDefault();
        const scale = event.deltaY > 0 ? 0.95 : 1 / 0.95;
        zoom(held || selected || null, scale);
    }

    function onRightDown(event) {
        if (evtPropKill) {return;}
        evtPropKill = true;
        setTimeout(() => evtPropKill = false);
        if (selectedContext) {
            selectedContext.style.display = 'none';
        }
        this.moved = false;
    }

    function onRightUp(event) {
        if (evtPropKill) {return;}
        evtPropKill = true;
        setTimeout(() => evtPropKill = false);
        if (!this.moved) {
            contextMenu(event.target === viewport ? 'viewport' : 'object', event);
        }
        this.moved = false;
    }

    function contextMenu(type, event) {
        let menu;
        if (type === 'viewport') {
            menu = context.viewport;
        } else if (type === 'object') {
            menu = context.object;
        } else {
            return;
        }
        noClick = false;
        if (menu === selectedContext) {
            selectedContext.style.display = 'none';
            setSelected(null);
            selectedContext = null;
            return;
        } else {
            if (selectedContext) {selectedContext.style.display = 'none';}
            selectedContext = menu;
        }

        if (event && event.target) {
            let left = event.data.global.x + 2;
            let top = event.data.global.y + 2;
            if (app.renderer.width - event.data.global.x < menu.offsetWidth + 4) {
                left -= menu.offsetWidth + 4;
            }
            if (app.renderer.height - event.data.global.y < menu.offsetHeight + 4) {
                top -= context.offsetHeight + 4;
            }
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';
            menu.style.display = 'block';

            if (type === 'object') {
                if (selected !== event.target) {
                    setSelected(event.target);
                } else {
                    menu.style.display = 'none';
                    setSelected(null);
                    selectedContext = null;
                }
            }
        } else {
            noClick = true;
            menu.style.display = 'none';
            setSelected(null);
            selectedContext = null;
        }
    }

    function onDragStart(event) {
        if (selectedContext) {
            selectedContext.style.display = 'none';
            selectedContext = null;
        }
        if (held) {return;}
        if (event.data.buttons === 4) {
            rotateSprite(this, 90);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (this !== map) {
            indexSprite(this, 1000);
            this.alpha = 0.98;
        }
        if (this !== selected) {
            setSelected(null);
        }
        this.data = event.data;
        this.dragging = this.data.getLocalPosition(this.parent);
        this.moved = false;
        held = this;
    }

    function onDragEnd() {
        if (!held) {return;}
        if (this !== map) {
            indexSprite(this, 0);
        }
        if (!this.moved) {
            if (this === selected) {
                setSelected(null);
            } else {
                setSelected(this);
            }
        }
        this.alpha = 1;
        this.dragging = false;
        this.moved = false;
        this.data = null;
        held = null;
    }

    function onDragMove(event) {
        this.moved = true;
        if (selectedContext && event.data.buttons === 2) {
            selectedContext.style.display = 'none';
            selectedContext = null;
        }
        if (this.dragging) {
            let newPos = this.data.getLocalPosition(this.parent);
            this.position.x += (newPos.x - this.dragging.x);
            this.position.y += (newPos.y - this.dragging.y);
            this.dragging = newPos;
        }
    }

    function onMouseOver(event) {
        if (this === map) {return;}
        if (hovered.length) {
            removeOutline(hovered[0], 'hovered');
        }
        addOutline(this, 'hovered', 0x00FF00);
        hovered.unshift(this);
    }

    function onMouseOut(event) {
        if (this === map) {return;}
        removeOutline(this, 'hovered');
        hovered = hovered.filter(sprite => sprite !== this);
        if (hovered.length) {
            addOutline(hovered[0], 'hovered', 0x00FF00);
        }
    }

    const keys = {
        'delete': keyboard('Delete', event => {
            if (!held && !selected) {return;}
            deleteSprite(held || selected);
        }),
        'q': keyboard('q', event => {
            if (!held && !selected && !map) {return;}
            rotateSprite(held || selected || map, -90);
        }),
        'e': keyboard('e', event => {
            if (!held && !selected && !map) {return;}
            rotateSprite(held || selected || map, 90);
        }),
        'w': keyboard('w', event => {
            zoom(held || selected || null, 1 / 0.99);
        }),
        's': keyboard('s', event => {
            zoom(held || selected || null, 0.99);
        }),
        'r': keyboard('r', event => {
            zoom(held || selected || null, 0);
        }),
        'a': keyboard('a', event => {
            if (held || selected === map) {return;}
            indexSprite(held || selected, -1, true);
        }),
        'd': keyboard('d', event => {
            if (held || selected === map) {return;}
            indexSprite(held || selected, 1, true);
        }),
        'f': keyboard('f', event => {
            if (held || selected === map) {return;}
            indexSprite(held || selected, 0, true);
        }),
        'g': keyboard('g', event => {
            displayGrid();
        }),
        'Control': keyboard('Control', event => {
            ctrl = true;
            document.getElementById('drawApp').classList.add('drawable');
        }, event => {
            document.getElementById('drawApp').classList.remove('drawable');
            ctrl = false;
        }),
        'Shift': keyboard('Shift', event => {
            shift = true;
        }, event => {
            shift = false;
        }),
        ' ': keyboard(' ', event => {
            streaming = !streaming;
            if (streaming) {
                document.getElementById('streamStatus').classList.remove('paused');
            } else {
                document.getElementById('streamStatus').classList.add('paused');
            }
        }),
    };

    function keyboard(value, press, release) {
        let key = {};
        key.value = value;
        key.isDown = false;
        key.isUp = true;
        key.press = press;
        key.release = release;

        key.downHandler = event => {
            if (event.key === key.value) {
                if (key.isUp && key.press) key.press(event);
                key.isDown = true;
                key.isUp = false;
                event.preventDefault();
            }
        };

        key.upHandler = event => {
            if (event.key === key.value) {
                if (key.isDown && key.release) key.release(event);
                key.isDown = false;
                key.isUp = true;
                event.preventDefault();
            }
        };

        const downListener = key.downHandler.bind(key);
        const upListener = key.upHandler.bind(key);

        window.addEventListener(
          'keydown', downListener, false
        );
        window.addEventListener(
          'keyup', upListener, false
        );
        
        key.unsubscribe = () => {
            window.removeEventListener('keydown', downListener);
            window.removeEventListener('keyup', upListener);
        };
        
        return key;
    }

    return {
        contextMenu,
        getSelected,
        deleteSprite,
        rotateSprite,
        zoom,
        indexSprite,
        displayGrid,
        hookStream
    };
};