var fullscreenEnabled = !document.location.hash.match(/^#nofullscreen/);

if (fullscreenEnabled) {
  setTimeout(function() {
    d3.select("body")
      .append("button")
      .attr("id", "fullscreen")
      .text("Fullscreen")
      .on("click", goFullscreen);
  }, 200);
}

function goFullscreen() {
  this._exitFired = false;
  if (fullScreenApi.supportsFullScreen) {
    if (fullScreenApi.isFullScreen(document.body)) {
      fullScreenApi.cancelFullScreen(document.body);
    } else {
      fullScreenApi.requestFullScreen(document.body);
    }
    setTimeout(redraw, 200);
  }
}

/*
Native FullScreen JavaScript API
-------------
Assumes Mozilla naming conventions instead of W3C for now

source : http://johndyer.name/native-fullscreen-javascript-api-plus-jquery-plugin/

*/

(function() {
  var fullScreenApi = {
      supportsFullScreen: false,
      isFullScreen: function() {
        return false;
      },
      requestFullScreen: function() {},
      cancelFullScreen: function() {},
      fullScreenEventName: "",
      prefix: ""
    },
    browserPrefixes = "webkit moz o ms khtml".split(" ");

  // check for native support
  if (typeof document.cancelFullScreen != "undefined") {
    fullScreenApi.supportsFullScreen = true;
  } else {
    // check for fullscreen support by vendor prefix
    for (var i = 0, il = browserPrefixes.length; i < il; i++) {
      fullScreenApi.prefix = browserPrefixes[i];
      if (
        typeof document[fullScreenApi.prefix + "CancelFullScreen"] !=
        "undefined"
      ) {
        fullScreenApi.supportsFullScreen = true;

        break;
      }
    }
  }

  // update methods to do something useful
  if (fullScreenApi.supportsFullScreen) {
    fullScreenApi.fullScreenEventName =
      fullScreenApi.prefix + "fullscreenchange";

    fullScreenApi.isFullScreen = function() {
      switch (this.prefix) {
        case "":
          return document.fullScreen;
        case "webkit":
          return document.webkitIsFullScreen;
        default:
          return document[this.prefix + "FullScreen"];
      }
    };
    fullScreenApi.requestFullScreen = function(el) {
      return this.prefix === ""
        ? el.requestFullScreen()
        : el[this.prefix + "RequestFullScreen"]();
    };
    fullScreenApi.cancelFullScreen = function(el) {
      return this.prefix === ""
        ? document.cancelFullScreen()
        : document[this.prefix + "CancelFullScreen"]();
    };

    document.addEventListener(fullScreenApi.fullScreenEventName, function() {
      if (fullScreenApi.isFullScreen(document.body)) {
        d3.select("button#fullscreen").html("&times;");
      } else {
        d3.select("button#fullscreen").html("Fullscreen");
      }
    });
  }

  // jQuery plugin
  if (typeof jQuery != "undefined") {
    jQuery.fn.requestFullScreen = function() {
      return this.each(function() {
        var el = jQuery(this);
        if (fullScreenApi.supportsFullScreen) {
          fullScreenApi.requestFullScreen(el);
        }
      });
    };
  }

  // export api
  window.fullScreenApi = fullScreenApi;
})();
