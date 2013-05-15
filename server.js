/**************************************/
/* Multiplayer Spaceships             */
/* node.js server script              */
/*                        jaburns.net */
/**************************************/

// ### A modified HSL to RGB algorithm for generating a low-sat player color ############

function getNewCoolColor()
{
    var h = Math.random();
    var s = 0.6;
    var v = 0.8;

    var var_R, var_G, var_B;
    
    var var_H = h * 6;
    var var_i = Math.floor( var_H );
    var var_1 = v * ( 1 - s );
    var var_2 = v * ( 1 - s * ( var_H - var_i ) );
    var var_3 = v * ( 1 - s * (1 - ( var_H - var_i ) ) );

    if       (var_i == 0) { var_R = v     ; var_G = var_3  ; var_B = var_1 ; }
    else if  (var_i == 1) { var_R = var_2 ; var_G = v      ; var_B = var_1 ; }
    else if  (var_i == 2) { var_R = var_1 ; var_G = v      ; var_B = var_3 ; }
    else if  (var_i == 3) { var_R = var_1 ; var_G = var_2  ; var_B = v     ; }
    else if  (var_i == 4) { var_R = var_3 ; var_G = var_1  ; var_B = v     ; }
    else                  { var_R = v     ; var_G = var_1  ; var_B = var_2 ; }

    var r = Math.floor( var_R * 255 ).toString(16);
    var g = Math.floor( var_G * 255 ).toString(16);
    var b = Math.floor( var_B * 255 ).toString(16);

    if( r.length < 2 ) r = "0" + r;
    if( g.length < 2 ) g = "0" + g;
    if( b.length < 2 ) b = "0" + b;
    
    return r+g+b;
}

// ### Game logic #######################################################################

var bullets = [];

function Bullet( owner )
{
    this.x = owner.x + owner.vx + 18 * Math.cos( owner.r );
    this.y = owner.y + owner.vy + 18 * Math.sin( owner.r );

    this.vx = 6 * Math.cos( owner.r ) + owner.vx;
    this.vy = 6 * Math.sin( owner.r ) + owner.vy;

    this.owner = owner;
    this.color = owner.color;
}

Bullet.prototype.update = function()
{
    this.x += this.vx;
    this.y += this.vy;
}

//-------------------------------------------------------------------------

var FIELD_WIDTH  = 1024;
var FIELD_HEIGHT =  768;

var SHIP_HIT_RADIUS_SQR = 15*15;
var SHIP_DRAW_RADIUS    = 20;

var SPEEDCAP     = 8;
var ACCELERATION = 0.2;
var TURN_SPEED   = 8 / 180 * Math.PI;

function Player()
{
    this.name = "";
    this.score = 0;
    this.color = getNewCoolColor();
    
    this.reset = function()
    {
        this.x =  FIELD_WIDTH * Math.random();
        this.y = FIELD_HEIGHT * Math.random();
        this.vx = 0;
        this.vy = 0;
        this.r  = 0;
        this.holdingSpace = false;
        this.latestKeys = {};
    }    
    this.reset();
}

Player.prototype.processInput = function( keys )
{
    this.latestKeys = keys;

    if( this.name === "" && keys["name"] ) {
        this.name = keys["name"];
    }
}

Player.prototype.update = function()
{
    if( this.latestKeys[ 37 ] ) this.r -= TURN_SPEED; // Left
    if( this.latestKeys[ 39 ] ) this.r += TURN_SPEED; // Right

    if( this.latestKeys[ 40 ] ) { // Down
        this.vx -= ACCELERATION*Math.cos( this.r );
        this.vy -= ACCELERATION*Math.sin( this.r );
    }
    
    if( this.latestKeys[ 38 ] ) { // Up
        this.vx += ACCELERATION*Math.cos( this.r );
        this.vy += ACCELERATION*Math.sin( this.r );
    }

    var m2 = this.vx*this.vx + this.vy*this.vy;
    if( m2 > SPEEDCAP*SPEEDCAP ) {
        var m = Math.sqrt( m2 );
        this.vx *= SPEEDCAP / m;
        this.vy *= SPEEDCAP / m;
    }

    if( this.latestKeys[ 32 ] ) { // Space
        if( !this.holdingSpace ) {
            this.holdingSpace = true;
            bullets.push( new Bullet( this ) );
        }
    } else {
        this.holdingSpace = false;
    }

    this.x += this.vx;
    this.y += this.vy;

    if( this.x >  FIELD_WIDTH+SHIP_DRAW_RADIUS ) this.x -=  FIELD_WIDTH+SHIP_DRAW_RADIUS;
    if( this.x <             -SHIP_DRAW_RADIUS ) this.x +=  FIELD_WIDTH+SHIP_DRAW_RADIUS;
    if( this.y > FIELD_HEIGHT+SHIP_DRAW_RADIUS ) this.y -= FIELD_HEIGHT+SHIP_DRAW_RADIUS;
    if( this.y <             -SHIP_DRAW_RADIUS ) this.y += FIELD_HEIGHT+SHIP_DRAW_RADIUS;

    for( var i = 0 ; i < bullets.length ; ++i )
    {
        var dx = this.x - bullets[i].x;
        var dy = this.y - bullets[i].y;
        
        if( dx*dx + dy*dy < SHIP_HIT_RADIUS_SQR )
        {
            if( bullets[i].owner === this ) {
                this.score--;
            } else {
                bullets[i].owner.score++;
            }
            bullets.splice( i, 1 );
            this.reset();
        }
    }
}

//-------------------------------------------------------------------------

function gameLoop()
{
    var statePacket = {
        p: [],
        b: [],
        i: -1
    };

    var deadBullets = [];
    for( var i = 0 ; i < bullets.length ; ++i )
    {
        bullets[i].update();
        if( bullets[i].x < 0 || bullets[i].x > FIELD_WIDTH || bullets[i].y < 0 || bullets[i].y > FIELD_HEIGHT ) {
            deadBullets.push( bullets[i] );
        }
        statePacket.b.push([
            bullets[i].x,
            bullets[i].y,
            bullets[i].color
        ]);
    }

    while( deadBullets.length > 0 ) {
        bullets.splice( bullets.indexOf( deadBullets.pop() ), 1 );
    }

    for( var i = 0 ; i < players.length ; ++i ) {
        players[i].update();
        statePacket.p.push([
            players[i].x,
            players[i].y,
            players[i].r,
            players[i].name,
            players[i].score,
            players[i].color,
        ]);
    }

    for( var i = 0 ; i < playerSockets.length ; ++i )
    {
        statePacket.i = i;
        playerSockets[i].volatile.send(JSON.stringify( statePacket ));
    }
}

// ### Statically serve the client page and raphael.js ##################################

var PORT = 1234;

var app = require("http").createServer(handler);
var io = require("socket.io").listen(app);
var fs = require("fs");
app.listen(PORT);
function handler( req, res )
{
    var filepath = req.url;
    if( filepath === "/" ) filepath = "/client.html";

    if( filepath !== "/client.html" && filepath !== "/raphael.js" ) {
        res.writeHead(500);
        return res.end("This server only serves spaceships!");
    }
    
    fs.readFile(__dirname + filepath,
    function (err, data) {
        if (err) {
            res.writeHead(500);
            return res.end("Error loading page.");
        }
        res.writeHead(200);
        res.end(data);
    });
}

// ### Socket.io configuration and connection management ################################

var players       = [];
var playerSockets = [];
var gameLoopInterval = null;

io.set( "log level", 2 );

io.sockets.on("connection", function( socket )
{
    var player = new Player();

    players.push( player );
    playerSockets.push( socket );

    socket.on("message", function( data ) {
        player.processInput( JSON.parse( data ) );
    });
    
    socket.on("disconnect", function()
    {
        var index = playerSockets.indexOf( socket );
        players.splice( index, 1 );
        playerSockets.splice( index, 1 );

        if( players.length === 0 ) {
            clearInterval( gameLoopInterval );
            gameLoopInterval = null;
        }
    });

    if( gameLoopInterval === null ) {
        gameLoopInterval = setInterval( gameLoop, 33 );
    }
});

// ######################################################################################