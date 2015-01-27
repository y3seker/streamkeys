;(function() {
  "use strict";

  var BaseController = function() { return this; };
  var sk_log = require("../modules/SKLog.js");

  BaseController.prototype.init = function(options) {
    this.name = document.location.hostname;
    this.siteName = options.siteName || null;

    this.selectors = {
      //** Properties **//
      playPause: (options.playPause || null),
      play: (options.play || null),
      pause: (options.pause || null),
      playNext: (options.playNext || null),
      playPrev: (options.playPrev || null),
      mute: (options.mute || null),
      like: (options.like || null),
      dislike: (options.dislike || null),
      iframe: (options.iframe || null),

      //** States **//
      playState: (options.playState || null),
      pauseState: (options.pauseState || null),

      // ** Song Change Observer **//
      songChange: (options.songChange || null),

      //** Song Info **//
      song: (options.song || null),
      artist: (options.artist || null)
    };

    // Optional. Style of play and pause buttons when they are NOT in use
    // EX: When a play button is in use, css class "playing" is added
    // In that case, set playStyle to "playing"
    this.playStyle = options.playStyle || null;
    this.pauseStyle = options.pauseStyle || null;

    // Previous player state, used to check vs current player state to see if anything changed
    this.oldState = {
      song: null,
      artist: null,
      isPlaying: null,
      siteName: null
    };

    // Set to true if the play/pause buttons share the same element
    this.buttonSwitch = options.buttonSwitch || false;

    // Default listener sends actions to main document
    this.attachListeners();

    chrome.runtime.sendMessage({created: true}, function() {
      sk_log("Told BG we are created");
    });

    sk_log("SK content script loaded");

    document.addEventListener("streamkeys-test-loaded", function() {
      sk_log("loaded");
    });
  };

  /**
   * Inject a script into the current document
   * @param file.url {String} /relative/path/to/script
   * @param file.script {String} plaintext script as a string
   */
  BaseController.prototype.injectScript = function(file) {
    var script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    if(file.url) {script.setAttribute("src", chrome.extension.getURL(file.url));}
    if(file.script) {script.innerHTML = file.script;}
    (document.head || document.documentElement).appendChild(script);
  };

  /**
   * Click inside document
   * @param opts.selectorButton {String} css selector for button to click
   * @param opts.action {String} name of action to log to console for debugging purposes
   * @param opts.selectorFrame {String} OPTIONAL css selector for iframe to send clicks to
   */
  BaseController.prototype.click = function(opts) {
    opts = opts || {};
    if(opts.selectorButton === null) {
      sk_log("disabled", opts.action);
      return;
    }

    var doc = (opts.selectorFrame) ? document.querySelector(opts.selectorFrame).contentWindow.document : document;
    if (!doc) return;

    try {
      doc.querySelector(opts.selectorButton).click();
      sk_log(opts.action);
    } catch(e) {
      sk_log("Element not found for click.", opts.selectorButton, true);
    }

    // Update the player state after a click
    this.updatePlayerState();
  };

  BaseController.prototype.playPause = function() {
    if(this.selectors.play !== null && this.selectors.pause !== null) {
      if(this.isPlaying()) {
        this.click({action: "playPause", selectorButton: this.selectors.pause, selectorFrame: this.selectors.iframe});
      } else {
        this.click({action: "playPause", selectorButton: this.selectors.play, selectorFrame: this.selectors.iframe});
      }
    } else {
      this.click({action: "playPause", selectorButton: this.selectors.playPause, selectorFrame: this.selectors.iframe});
    }
  };

  BaseController.prototype.playNext = function() {
    this.click({action: "playNext", selectorButton: this.selectors.playNext, selectorFrame: this.selectors.iframe});
  };

  BaseController.prototype.playPrev = function() {
    this.click({action: "playPrev", selectorButton: this.selectors.playPrev, selectorFrame: this.selectors.iframe});
  };

  BaseController.prototype.mute = function() {
    this.click({action: "mute", selectorButton: this.selectors.mute, selectorFrame: this.selectors.iframe});
  };

  BaseController.prototype.like = function() {
    this.click({action: "like", selectorButton: this.selectors.like, selectorFrame: this.selectors.iframe});
  };

  BaseController.prototype.dislike = function() {
    this.click({action: "dislike", selectorButton: this.selectors.dislike, selectorFrame: this.selectors.iframe});
  };

  /**
   * Attempts to check if the site is playing anything
   * @return {Boolean} true if site is currently playing
   */
  BaseController.prototype.isPlaying = function() {
    // Check for player iFrame
    var doc = (this.selectors.iframe) ? document.querySelector(this.selectors.iframe).contentWindow.document : document;

    var playEl = doc.querySelector(this.selectors.play),
        playPauseEl = doc.querySelector(this.selectors.playPause),
        isPlaying = false;

    if(this.buttonSwitch) {
      // If playEl does not exist then it is currently playing
      isPlaying = (playEl === null);
    }
    else {
      // Check for play/pause style overrides
      if(this.playStyle) {
        // Check if the class list contains the class that is only active when play button is playing
        isPlaying = playPauseEl.classList.contains(this.playStyle);
      }
      else {
        // Check if the pause element exists
        if(this.selectors.playState) {
          isPlaying = (doc.querySelector(this.selectors.playState) !== null);
        }
        // Hack to get around sometimes not being able to read css properties that are not inline
        else if(playEl) {
          var displayStyle = "none";
          if (playEl.currentStyle) {
            displayStyle = playEl.currentStyle.display;
          } else if (window.getComputedStyle) {
            displayStyle = window.getComputedStyle(playEl, null).getPropertyValue("display");
          }
          isPlaying = (displayStyle == "none");
        }
        else {
          return null;
        }
      }
    }

    // sk_log("IsPlaying: " + isPlaying);
    return isPlaying;
  };
  /**
   * Gets the current state of the music player and passes data to background page (and eventually popup)
   */
  BaseController.prototype.updatePlayerState = function() {
    var newState = this.getStateData();
    if(JSON.stringify(newState) !== JSON.stringify(this.oldState)) {
      console.log("state change!");
      this.oldState = newState;
      chrome.runtime.sendMessage({
        action: "update_player_state",
        stateData: newState
      });
    }
  };

  /**
   * Gets an object containing the current player state data
   * @return {{song: {String}, artist: {String}, isPlaying: {Boolean}, siteName: {String}}}
   */
  BaseController.prototype.getStateData = function() {
    return {
      song: this.getSongData(this.selectors.song),
      artist: this.getSongData(this.selectors.artist),
      isPlaying: this.isPlaying(),
      siteName: this.siteName
    };
  };

  /**
   * Gets the text value from a song data selector
   * @param selector {String} selector for song data
   * @return {*} song data if element is found, null otherwise
   */
  BaseController.prototype.getSongData = function(selector) {
    if(!selector) return null;

    // Check for player iFrame
    var doc = (this.selectors.iframe) ? document.querySelector(this.selectors.iframe).contentWindow.document : document;

    var dataEl = doc.querySelector(selector);
    if(dataEl && dataEl.textContent) {
      return dataEl.textContent;
    }

    return null;
  };

  /**
   * Checks if a BaseController property is set. Used for testing.
   * @param property {String} name of property to check for
   */
  BaseController.prototype.getProperty = function(property) {
    if(this[property]) sk_log(property);
    else sk_log("Property not found.", property, true);
  };

  /**
   * Callback for request from background page
   */
  BaseController.prototype.doRequest = function(request, sender, response) {
    if(typeof request !== "undefined") {
      if(request.action === "playPause") this.playPause();
      if(request.action === "playNext") this.playNext();
      if(request.action === "playPrev") this.playPrev();
      if(request.action === "mute") this.mute();
      if(request.action === "like") this.like();
      if(request.action === "dislike") this.dislike();
      if(request.action === "getPlayerState") {
        var newState = this.getStateData();
        this.oldState = newState;
        response(newState);
      }
    }
  };

  /**
   * Callback for request from tester
   */
  BaseController.prototype.doTestRequest = function(e) {
    if(e.detail) {

      if(e.detail === "playPause" || e.detail === "playNext" || e.detail === "playPrev" || e.detail === "mute" || e.detail === "like"|| e.detail === "dislike" ) {
        this.doRequest({action: e.detail});
      }

      if(e.detail == "songName") this.test_getSongData(this.selectors.song);
      if(e.detail == "artistName") this.test_getSongData(this.selectors.artist);
      if(e.detail == "siteName") this.getProperty("siteName");
      if(e.detail == "isPlaying") this.isPlaying();
    }
  };

  /**
   * Process a test request to get song data
   * @param selector {String} query selector for song data text
   */
  BaseController.prototype.test_getSongData = function(selector) {
    var songData = this.getSongData(selector);
    if(songData) {
      sk_log("Song data: ", songData);
    }
    else {
      sk_log("Song data not found.", {}, true);
    }
  };

  /**
   * Setup listeners for extension messages and test requests. Initialize the playerState interval
   */
  BaseController.prototype.attachListeners = function() {
    // Listener for requests from background page
    chrome.runtime.onMessage.addListener(this.doRequest.bind(this));

    // Listener for requests from tests
    document.addEventListener("streamkeys-test", this.doTestRequest.bind(this));

    // Update the popup player state intermittently
    setInterval(this.updatePlayerState.bind(this), 200);

    sk_log("Attached listener for ", this);
  };

  module.exports = new BaseController();
})();
