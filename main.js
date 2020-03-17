const {
  ipcMain
} = require('electron');
const fs = require('fs');

const window = require("./lib/window.js");

var socks = require('socksv5');
var Client = require('ssh2').Client;

let server = null;
let socksConnections = {};

/*
 *	Create channels to communicate with frontend
 */

ipcMain.on('getState', (event, arg) => {
  event.returnValue = Object.assign({}, state);
})

ipcMain.on('show', (event, arg) => {
  window.show();
})

ipcMain.on('logoff', (event, arg) => {
  //Update state
  state.enabled = false;
  state.username = "";
  state.password = "";
  state.saveCredentials = false;
  state.isValid = true;

  state.selectedServer = "";

  //Update settings & window
  updatePrinter();
  updateSettings();
  updateWindow();
});

ipcMain.on('login', async (event, arg) => {
  //Update state
  state = Object.assign(state, arg);

  //Login
  await login();
  updateSettings();
  updateWindow();

});

/*
 *	Default start state
 */
let state = {
  //Is printer enabled or must user provide credentials?
  enabled: false,

  //Config
  host: "",
  port: 0,

  //State for login card
  username: "",
  password: "",
  saveCredentials: false,
  isValid: true,

  //State for printer card
  selectedServer: "",
};

/*
 *	Load credentials from file
 */
(async () => {
  let settings = JSON.parse(fs.readFileSync(__dirname + "/config/settings.json", 'utf8'));

  if (typeof settings.host != "undefined") {
    state.host = "" + settings.host;
  }

  if (typeof settings.port != "undefined") {
    state.port = 1 * settings.port;
  }

  if (typeof settings.selectedServer != "undefined") {
    state.selectedServer = "" + settings.selectedServer;
  }

  if (typeof settings.username != "undefined") {
    state.username = "" + settings.username;
  }

  if (typeof settings.password != "undefined") {
    state.password = "" + settings.password;
  }

  if (state.username != "" && state.password != "") {
    state.saveCredentials = true;
    await login();

  }

  /*
   *	Load window
   */
  window.load();
})();


/*
 *	Update settings function
 */

function updateSettings() {
  //Update settings
  let data = {
    host: state.host,
    port: state.port,
    username: "",
    password: "",
    selectedServer: state.selectedServer
  };

  if (state.saveCredentials) {
    data.username = state.username;
    data.password = state.password;
  }

  fs.writeFileSync(__dirname + "/config/settings.json", JSON.stringify(data), 'utf8');
}


function updateWindow() {
  window.send("setState", state);
}

function updatePrinter() {
  if (state.enabled) {
    if (!server) {
      server = socks.createServer(function(info, accept, deny) {
        // NOTE: you could just use one ssh2 client connection for all forwards, but
        // you could run into server-imposed limits if you have too many forwards open
        // at any given time
				var key = JSON.stringify(info);

        var conn = new Client();
				socksConnections[key] = conn;

        conn.on('end', () => {
					delete socksConnections[key];
				}).on('ready', function() {
          conn.forwardOut(info.srcAddr,
            info.srcPort,
            info.dstAddr,
            info.dstPort,
            function(err, stream) {
              if (err) {
                conn.end();
                return deny();
              }

              var clientSocket;
              if (clientSocket = accept(true)) {
                stream.pipe(clientSocket).pipe(stream).on('close', function() {
                  conn.end();
                });
              } else
                conn.end();
            });
        }).on('error', function(err) {
					deny();
					state.enabled = false;
		      state.isValid = false;
					if (server) {
			      server.close();
						for (var key in socksConnections) {
								socksConnections[key].destroy();
						}
			      server = null;
			    }
        }).connect({
          host: state.selectedServer + "." + state.host,
          port: state.port,
          username: state.username,
          password: state.password
        });
      }).listen(1080, 'localhost', function() {
        console.log('SOCKSv5 proxy server started on port 1080');
				updateWindow();
      }).useAuth(socks.auth.None());
    }
  } else {
    if (server) {
      server.close();
			for (var key in socksConnections) {
					socksConnections[key].destroy();
			}
      server = null;
    }
  }
}

/*
 *	Login function
 */

async function login() {
  return new Promise((resolve, reject) => {
    // Check if username and password are provided
    if (state.username == "" || state.password == "") {
      state.isValid = false;
      resolve();
    }

    state.enabled = true;
    state.isValid = true;
    updatePrinter();
    resolve();
  });
}
