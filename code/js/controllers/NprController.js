;(function() {
  "use strict";

  var controller = require("BaseController");

  controller.init({
    siteName: "NPR",
    play: "a.play",
    pause: "a.pause",
    playNext: "a.next",

    pauseStyle: "a.pause",
    song: ".title"
  });
})();
