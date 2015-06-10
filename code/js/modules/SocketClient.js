;(function() {
  "use strict";

  var io = require("socket");
  var SocketClient = function() { return this; };

  SocketClient.prototype.init = function() {
    console.log("init time");
    var socket = io("http://localhost:4444");

    // TODO: validate the data
    socket.on("command", function(data) {
      console.log("Command received: ", data);
      if(data.command === "getPlayerStates") {
        window.sk_sites.getPlayerstates().then(function(playerStates) {
          console.log("states: ", playerStates);
          socket.emit("playerStates", { playerStates: playerStates });
        });
      }
      else {
        chrome.runtime.sendMessage({
          action: "command",
          command: data.command
        });
      }
    });
  };

  module.exports = new SocketClient();
})();
