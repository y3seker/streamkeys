;(function() {
  "use strict";

  var io = require("socket");
  var SocketClient = function() { return this; };

  SocketClient.prototype.init = function() {
    console.log("init time");
    var socket = io("http://localhost:4444");
    socket.on("news", function (data) {
      console.log(data);
      socket.emit("my other event", { my: "data" });
    });

    // TODO: validate the data
    socket.on("command", function(data) {
      console.log("Command received: ", data);
      if(data.command === "getPlayerState") {
        var playerStates = [];
        var musicTabs = window.sk_sites.getMusicTabs();
        musicTabs.then(function(tabs) {
          tabs.forEach(function(tab) {
            chrome.tabs.sendMessage(tab.id, { action: "getPlayerState" }, function(playerState) {
              console.log("state: ", playerState);
              playerStates.push(playerState);
            });

            console.log("player states: ", playerStates);
            socket.emit("playerStates", { data: playerStates });
          });
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
