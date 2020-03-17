const { app, BrowserWindow, Tray, ipcMain} = require('electron');

let _tray = null;
let _mainWindow = null;
let _doExit = false;

/*
 *	Window managing functions
 */


function show() {
	if(_mainWindow) {
		_mainWindow.show();
	}
}

function send(action, obj) {
	if(_mainWindow) {
		_mainWindow.send(action, Object.assign({}, obj));
	}
}

function load() {
	// On start create tray en create (invisible window)
	function onReady() {
		_tray = new Tray(__dirname + "/../images/icon@2x.png");
	    _tray.on("click", () => {
	    	if(_mainWindow) {
	    		_mainWindow.show();
	    	} else {
	    		_createWindow();
	    	}
	    });
	    _createWindow();
	}

	if(app.isReady()) {
		onReady();
	} else {
		app.on('ready', () => {
			onReady();
		});
	}
}

// Create the browser window
function _createWindow() {
	_mainWindow = new BrowserWindow({
		width: 800,
		height: 500,
		show: false,
		center: true,
		resizable: false,
		maximizable: false,
		devTools: true,
		skipTaskbar: true
	});


	// Do not show the window on startup
	// _mainWindow.once('ready-to-show', () => {
	// 	_mainWindow.show();
	// });

	_mainWindow.on('minimize', (event) =>{
		//Remove window but keep app running in tray
	    event.preventDefault();
	   	_mainWindow.destroy();
	});

	_mainWindow.on('close', (event) => {
		//Allow app to exit
		_doExit = true;
	});

	_mainWindow.on('closed', (event) => {
		//Remove reference from old window
		_mainWindow = null;
	});


	// Load the index.html of the app.
	_mainWindow.loadFile(__dirname + '/../index.html')
}

module.exports = {
	show: show,
	send: send,
	load: load,
};

// Do not show app in task bar
if(app.dock) {
	app.dock.hide();
}

// Only quit when we press close.
app.on('window-all-closed', () => {
	if(_doExit) {
		app.quit();
	}
})
