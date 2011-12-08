const widgets = require("widget");
const timer = require("timer");
const request = require("request");
const tabs = require("tabs");
const self = require("self");
const simpleStorage = require("simple-storage");
const pageMod = require('page-mod');
const { jetpackID } = require("@packaging");
var {Cc, Ci} = require("chrome");

var parseQuakeFeedAndShake = function(xml, position)
{
    console.log("Parsing earthquake feed");

    var entries = xml.getElementsByTagName("entry");

    simpleStorage.storage.quakes = [];

    var minimumQuakeMagnitude = parseFloat(require("preferences-service").get("extensions."+jetpackID+".minimumQuakeMagnitude", "2.5"));
    var maximumQuakeDistance = parseInt(require("preferences-service").get("extensions."+jetpackID+".maximumQuakeDistance", "500"));

    console.log("Minimum quake magnitude = " + minimumQuakeMagnitude + ". Maximum quake distance = " + maximumQuakeDistance + "km.");

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

            console.log("Earthquake of magnitude " + magnitude + " '" + desc
                    + "' happened " + mins + " mins ago and " + distance + "km away.");

            if (mins < 60 && distance < maximumQuakeDistance && magnitude >= minimumQuakeMagnitude)
                shakeBrowserWindow(100);
        }
        else
        {
            console.log("Earthquake of magnitude " + magnitude + " '" + desc
                    + "' happened " + mins + " mins ago.");
        }
    }

    if (simpleStorage.storage.myworker)
    {
        timer.setTimeout(function()
        {
            simpleStorage.storage.myworker.port.emit('quakes', simpleStorage.storage.quakes);
            simpleStorage.storage.myworker.port.emit('mylocation', simpleStorage.storage.mylocation);
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
    //req.open("GET", "http://dl.dropbox.com/u/2575442/1day-M2.5.xml", true);
    req.send(null);
}

var shakeBrowserWindow = function(c, bw)
{
/*
    if (!bw)
        bw = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getMostRecentWindow("navigator:browser");

    var screenX = bw.screenX;

    if (c<0) return;
    var w = Math.sin((new Date()).getTime());
    bw.moveTo(screenX+w*c, 0);
    timer.setTimeout(function() shakeBrowserWindow(c-1, bw), 10);
*/

    tabs.activeTab.attach({contentScript:
        "for (let i=10; i>0; i--)" + 
        "let (x=i) { setTimeout(function() { document.body.style.MozTransform = 'rotate(' + (x%2==0?'-':'') + x + 'deg)'; }, (10-i)*100); }" +
        "setTimeout(function() { document.body.style.MozTransform = ''; }, 1100);"
    });

    //ssPanel.port.emit('quake', '');
    //ssPanel.show();

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
        console.log("Getting geo location...");

        var position = Cc["@mozilla.org/geolocation;1"].getService(Ci.nsIDOMGeoGeolocation).getCurrentPosition(function(position)
        {
            console.log("Geo location is " + position.coords.latitude + " , " + position.coords.longitude);

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
        require('self').data.url('icon-16x16.png').toString(),
        nb.PRIORITY_INFO_HIGH,
        [acceptButton, declineButton]);
}

/*
var ssPanel = require("panel").Panel({
    width:215,
    height:160,
    contentScript: "self.port.on('quake', function() { document.getElementById('quake').style.display = 'block'; });",
    contentURL: require('self').data.url("panel.htm")
});
*/

var ssWidget = widgets.Widget({
    id: "seismic-shaker",
    label: "Seismic Shaker",
    contentURL: require('self').data.url('icon-16x16.png').toString(),
    onClick: function(e) { openSeismicShaker(); }
    //panel: ssPanel
});

pageMod.PageMod(
{
    include: [require('self').data.url('seismicshaker.htm').toString()],
    contentScriptWhen: 'ready',
    contentScript: 'document.addEventListener("SeismicShakerTest", function(e) { self.postMessage("restart") }, false, true);',
    onAttach: function(worker) { worker.on("message", function() { shakeBrowserWindow(100); }) }
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
          //tab.contentDocument.addEventListener("SeismicShakerTest", function(e) { shakeBrowserWindow(100); }, false, true);
          //tab.contentDocument.addEventListener("SeismicShakerOpenAddonsManager", function(e) { tabs.open({url: "about:addons"}); }, false, true);

          tab.on('ready', function(tab) {
              tab.attach({contentScript: 'document.getElementById("version").textContent = "v' + self.version + '";'});
              simpleStorage.storage.myworker = tab.attach({contentScriptFile: require('self').data.url('seismicshaker.js').toString()});
                /*tab.attach({contentScript: "self.port.on('quakes', function(message) {" +
                                            " window.alert(message.length);" +
                                                                  "})"});(*/
              //simpleStorage.storage.myworker.port.emit('alert', 'test');

              if (simpleStorage.storage.quakes)
              {
                  timer.setTimeout(function()
                  {
                      simpleStorage.storage.myworker.port.emit('quakes', simpleStorage.storage.quakes);
                      simpleStorage.storage.myworker.port.emit('mylocation', simpleStorage.storage.mylocation);
                  }, 500);
              }
          });

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

