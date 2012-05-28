/*This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.*/

const widgets = require("widget");
const timer = require("timer");
const request = require("request");
const tabs = require("tabs");
const self = require("self");
const simpleStorage = require("simple-storage");
const pageMod = require('page-mod');
const { jetpackID } = require("@packaging");
var {Cc, Ci} = require("chrome");

var myworker = null;

// disable debug logging for AMO
var console = new function() {}; console.debug = function() {};

var parseQuakeFeedAndShake = function(xml, position)
{
    console.debug("Parsing earthquake feed");

    var entries = xml.getElementsByTagName("entry");

    simpleStorage.storage.quakes = [];

    var minimumQuakeMagnitude = parseFloat(require("simple-prefs").prefs.minimumQuakeMagnitude);
    var maximumQuakeDistance = parseInt(require("simple-prefs").prefs.maximumQuakeDistance);

    console.debug("Minimum quake magnitude = " + minimumQuakeMagnitude + ". Maximum quake distance = " + maximumQuakeDistance + "km.");

    var re = /M (\d+\.\d)/;  

    for (var i=0; i<entries.length; i++)
    {
        var d = parseAtomDate(entries[i].getElementsByTagName("updated")[0].textContent);
        var mins = Math.floor(((new Date()).getTime() - d.getTime()) / 1000 / 60);

        var point = entries[i].getElementsByTagNameNS("http://www.georss.org/georss", "point")[0].textContent.toString();
        var [lat1, lng1] = point.split(/ /);
        lat1 = parseFloat(lat1);
        lng1 = parseFloat(lng1);

        var desc = entries[i].getElementsByTagName("title")[0].textContent;
        var magnitude = parseFloat(re.exec(desc)[1]);

        simpleStorage.storage.quakes.push({lat: lat1, lng: lng1, desc: desc, date: d.toUTCString()});

        if (position)
        {
            lat2 = parseFloat(position.coords.latitude);
            lng2 = parseFloat(position.coords.longitude);

            simpleStorage.storage.mylocation = {lat: lat2, lng: lng2};

            var distance = calcDistanceBetween2Points(lat1, lng1, lat2, lng2);

            console.debug("Earthquake of magnitude " + magnitude + " '" + desc
                    + "' happened " + mins + " mins ago and " + distance + "km away.");

            if (mins < 60 && distance < maximumQuakeDistance && magnitude >= minimumQuakeMagnitude)
                shakeBrowserWindow(100);
        }
        else
        {
            console.debug("Earthquake of magnitude " + magnitude + " '" + desc
                    + "' happened " + mins + " mins ago.");
        }
    }

    if (myworker)
    {
        timer.setTimeout(function()
        {
            myworker.port.emit('quakes', simpleStorage.storage.quakes);
            myworker.port.emit('mylocation', simpleStorage.storage.mylocation);
        }, 500);
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

var checkRecentQuakesNear = function(position)
{
    console.debug("Retrieving quake data...");

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
    //req.open("GET", "http://dl.dropbox.com/u/2575442/1day-M2.5.xml", true);
    req.send(null);
}

var shakeBrowserWindow = function(c, bw)
{
    var worker = tabs.activeTab.attach({contentScriptFile: self.data.url("shake.js")});
    worker.port.emit('shake', simpleStorage.storage.mylocation);

    var mediator = Cc['@mozilla.org/appshell/window-mediator;1']  
        .getService(Components.interfaces.nsIWindowMediator);  
    var doc = mediator.getMostRecentWindow("navigator:browser").document;  
    doc.getElementById("addon-bar").collapsed = false;  
}

var getGeoLocationAndCheckRecentQuakes = function()
{
    if (!simpleStorage.storage.hasGeoLocationPermission)
    {
        console.debug("We don't yet have permission to get geo location");
        
        checkRecentQuakesNear(null);
    }
    else
    {
        console.debug("Getting geo location...");

        var position = Cc["@mozilla.org/geolocation;1"].getService(Ci.nsIDOMGeoGeolocation).getCurrentPosition(function(position)
        {
            console.debug("Geo location is " + position.coords.latitude + " , " + position.coords.longitude);

            checkRecentQuakesNear(position);
        });
    }
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

var promptForGeoLocationPermission = function()
{
    let nb = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getMostRecentWindow("navigator:browser").gBrowser.getNotificationBox();
    let acceptButton = new Object();
    let declineButton = new Object();

    acceptButton.label = "Share Location";
    acceptButton.popup = null;
    acceptButton.callback = function() { simpleStorage.storage.hasGeoLocationPermission = true; getGeoLocationAndCheckRecentQuakes();};

    declineButton.label = "Cancel";
    declineButton.callback = function() {  };

    nb.appendNotification(
        "Seismic Shaker wants to know your location.",
        "seismicshaker-geolocation-notification",
        self.data.url('icon-16x16.png').toString(),
        nb.PRIORITY_INFO_HIGH,
        [acceptButton, declineButton]);
}

var ssWidget = widgets.Widget({
    id: "seismic-shaker",
    label: "Seismic Shaker",
    contentURL: self.data.url('icon-16x16.png').toString(),
    onClick: function(e) { openSeismicShaker(); }
});

pageMod.PageMod(
{
    include: [self.data.url('seismicshaker.htm').toString()],
    contentScriptWhen: 'ready',
    contentScriptFile: self.data.url("seismicshaker.js"),
    onAttach: function(worker)
    {
        myworker = worker;
   
        if (simpleStorage.storage.quakes)
        {
            timer.setTimeout(function()
            {
                worker.port.emit('quakes', simpleStorage.storage.quakes);
                worker.port.emit('mylocation', simpleStorage.storage.mylocation);
            }, 500);
        }

        worker.port.emit('version', self.version);
 
        worker.on("message", function(msg)
        {
            if (msg == 'test') { shakeBrowserWindow(100); }
            if (msg == 'openaddons') { tabs.open({url: "about:addons"}); }
        });
    }
});

var openSeismicShaker = function()
{
    var url = self.data.url("seismicshaker.htm");

    var windows = require("windows").browserWindows;

    for each (var window in windows)
    {
        for each (var tab in window.tabs)
        {
            if (tab.url == url)
            {
                tab.activate();
                return;
            }
        }
    }

    tabs.open({
      url: self.data.url("seismicshaker.htm"),
      onOpen: function(tab) {
          simpleStorage.storage.hasShownFirstRun = true;
      }
    });
}

exports.main = function(options, callback)
{
    console.debug("Initializing Seismic Shaker");

    if (!simpleStorage.storage.hasShownFirstRun)
        openSeismicShaker();

    if (!simpleStorage.storage.hasGeoLocationPermission)
        promptForGeoLocationPermission();

    getGeoLocationAndCheckRecentQuakes();
};

