const widgets = require("widget");
const timer = require("timer");
const request = require("request");
const tabs = require("tabs");
const self = require("self");
const simpleStorage = require("simple-storage");
const pageMod = require('page-mod');
var {Cc, Ci} = require("chrome");

var parseQuakeFeedAndShake = function(xml, position)
{
    var entries = xml.getElementsByTagName("entry");

    for (var i=0; i<entries.length; i++)
    {
        var d = parseAtomDate(entries[i].getElementsByTagName("updated")[0].textContent);
        var mins = Math.floor(((new Date()).getTime() - d.getTime()) / 1000 / 60);

        var point = entries[i].getElementsByTagNameNS("http://www.georss.org/georss", "point")[0].textContent.toString();
        var [lat1, lng1] = point.split(/ /);
        lat1 = parseFloat(lat1);
        lng1 = parseFloat(lng1);
        lat2 = parseFloat(position.coords.latitude);
        lng2 = parseFloat(position.coords.longitude);

        var distance = calcDistanceBetween2Points(lat1, lng1, lat2, lng2);

        console.log("Earthquake in " + entries[i].getElementsByTagName("title")[0].textContent
                + " happened " + mins + " mins ago and " + distance + "km away.");

        if (mins < 60 && distance < 500)
            shakeBrowserWindow(100);
    }
}

var calcDistanceBetween2Points = function(lat1, lng1, lat2, lng2)
{
    var toRad = function(num)
    {
        return num * Math.PI / 180;
    };

    var R = 6371; // km
    var dLat = toRad(lat2-lat1);
    var dLon = toRad(lng2-lng1);
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d;
}

/* XXX request API is currently broken
var checkRecentQuakesNearPosition = function(position)
{
    console.log("Retrieving quake data...");

    new request.Request({
            url: "http://earthquake.usgs.gov/earthquakes/catalogs/1day-M2.5.xml",
            //url: "file:///Users/mackers/tmp/1day-M2.5.xml",
            content: {},
            onComplete: function()
            {
                try 
                {
                    parseQuakeFeedAndShake(this.response.xml, position);
                }
                catch (e)
                {
                    console.error("Error parsing earthquake feed: " + e);
                }

                timer.setTimeout(getGeoLocationAndCheckRecentQuakes, 1000*60*60);
            }
    }).get();
}
*/

var checkRecentQuakesNear = function(position)
{
    console.log("Retrieving quake data...");

    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    req.onreadystatechange = function (aEvt)
    {
        if (req.readyState == 4)
        {
            if (req.status == 200)
            {
                try 
                {
                    parseQuakeFeedAndShake(this.responseXML, position);
                }
                catch (e)
                {
                    console.error("Error parsing earthquake feed: " + e);
                }
            }
            else
            {
                console.error("Error retrieving earthquake feed.");
            }

            timer.setTimeout(getGeoLocationAndCheckRecentQuakes, 1000*60*60);
        }
    };
    req.open("GET", "http://earthquake.usgs.gov/earthquakes/catalogs/1day-M2.5.xml", true);
    req.send(null);
}

var shakeBrowserWindow = function(c, bw)
{
    if (!bw)
        bw = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getMostRecentWindow("navigator:browser");

    if (c<0) return;
    var w = Math.sin((new Date()).getTime());
    bw.moveTo(w*c, 0);
    timer.setTimeout(function() shakeBrowserWindow(c-1, bw), 10);
}

var getGeoLocationAndCheckRecentQuakes = function()
{
    console.log("Getting geo location...");

    var position = Cc["@mozilla.org/geolocation;1"].getService(Ci.nsIDOMGeoGeolocation).getCurrentPosition(function(position)
    {
        console.log("Geo location is " + position.coords.latitude + " , " + position.coords.longitude);

        checkRecentQuakesNear(position);
    });
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

pageMod.PageMod(
{
    include: [require('self').data.url('firstrun.htm').toString()],
    contentScriptWhen: 'ready',
    contentScript: 'document.addEventListener("SeismicShakerTest", function(e) { postMessage("restart") }, false, true);',
    onAttach: function(worker) { worker.on("message", function() { shakeBrowserWindow(100); }) }
});

exports.main = function(options, callback)
{
    console.debug("Initializing Seismic Shaker");

    if (!simpleStorage.storage.hasShownFirstRun)
    {
        tabs.open({
          url: self.data.url("/firstrun.htm"),
          onOpen: function(tab) {
              simpleStorage.storage.hasShownFirstRun = true;
              //tab.contentDocument.addEventListener("SeismicShakerTest", function(e) { shakeBrowserWindow(100); }, false, true);
              //tab.contentDocument.addEventListener("SeismicShakerOpenAddonsManager", function(e) { tabs.open({url: "about:addons"}); }, false, true);
          }
        });
    }

    getGeoLocationAndCheckRecentQuakes();
};

