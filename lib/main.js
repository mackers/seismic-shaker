const widgets = require("widget");
const timer = require("timer");
const request = require("request");
const tabs = require("tabs");
const self = require("self");
const simpleStorage = require("simple-storage");

var check = function()
{
    request.Request({
            url: "http://earthquake.usgs.gov/earthquakes/catalogs/1day-M2.5.xml",
            content: {},
            onComplete: function()
            {
                    if (!request.response || !request.response.xml) return;
                    
                    var entries = request.response.xml.getElementsByTagName("entry");
                    
                    for (var i=0; i<entries.length; i++)
                    {
                            var d = parseAtomDate(entries[i].getElementsByTagName("updated")[0].textContent);
                            var mins = Math.floor(((new Date()).getTime() - d.getTime()) / 1000 / 60);
                            console.log("Earthquake in " + entries[i].getElementsByTagName("title")[0].textContent
                                    + " happened " + mins + " mins ago.");
                                    
                            if (mins < 60)
                                    shake(100);
                    }
                    
                    timer.setTimeout(check, 1000*60*60);
            }
    }).get();
}

var {Cc, Ci} = require("chrome");
var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
var browserWindow = wm.getMostRecentWindow("navigator:browser");

var shake = function(c)
{
    if (c<0) return;
    var w = Math.sin((new Date()).getTime());
    browserWindow.moveTo(w*c, 0);
    timer.setTimeout(function() shake(c-1), 10);
}

var parseAtomDate = function(datestr)
{
    var yy   = datestr.substring(0,4);
    var mo   = datestr.substring(5,7);
    var dd   = datestr.substring(8,10);
    var hh   = datestr.substring(11,13);
    var mi   = datestr.substring(14,16);
    var ss   = datestr.substring(17,19);
    return new Date(Date.UTC(yy-0,mo-1,dd-0,hh-0,mi-0,ss-0));
}

/*
widgets.add(widgets.Widget({
    label: "Quakeyfox",
    image: "http://earthquake.usgs.gov/favicon.ico",
    onClick: function(e) { shake(100); }
}));
*/

// This is an active module of the My Add-on Add-on
exports.main = function(options, callback)
{
    if (!simpleStorage.storage.hasShownFirstRun)
    {
        tabs.open({
          url: self.data.url("/firstrun.htm"),
          onOpen: function(tab) {
              simpleStorage.storage.hasShownFirstRun = true;
              tab.contentDocument.addEventListener("SeismicShakerTest", function(e) { shake(100); }, false, true);
              //tab.contentDocument.addEventListener("SeismicShakerOpenAddonsManager", function(e) { tabs.open({url: "about:addons"}); }, false, true);
          }
        });
    }

    check();
};

