self.port.on('mylocation', function(mylocation)
{
    /*
    var OpenLayers = unsafeWindow.OpenLayers;
    var circle = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(mylocation.lng, mylocation.lat), { type: "circle" });

    unsafeWindow.circle.addFeatures([circle]);
    */

    if (!mylocation)
        return;

    var map = unsafeWindow.map;
    var mylocationmarker = unsafeWindow.mylocationmarker;
    var OpenLayers = unsafeWindow.OpenLayers;

    if (!map)
        return;

    if (unsafeWindow.currentPopup)
        unsafeWindow.currentPopup.hide();

    mylocationmarker.clearMarkers();

    /*
    var size = new OpenLayers.Size(21,25);
    var offset = new OpenLayers.Pixel(-(size.w/2), -size.h);
    var icon = new OpenLayers.Icon('img/marker-blue.png', size, offset);
    var marker = new OpenLayers.Marker(new OpenLayers.LonLat(mylocation.lng, mylocation.lat),icon);

    mylocationmarker.addMarker(marker);
    */

        var feature = new OpenLayers.Feature(mylocationmarker, new OpenLayers.LonLat(mylocation.lng, mylocation.lat)); 
        feature.closeBox = true;
        feature.popupClass = OpenLayers.Class(OpenLayers.Popup.AnchoredBubble, {'autoSize': true});
        feature.data.popupContentHTML = "You are here.";
        feature.data.overflow = "auto";
                
        var marker = feature.createMarker();

/*
        marker.size = new OpenLayers.Size(21,25);
        marker.offset = new OpenLayers.Pixel(-(marker.size.w/2), -marker.size.h);
        marker.icon = new OpenLayers.Icon('img/marker-blue.png', marker.size, marker.offset);
        */

        marker.icon.url = "img/marker-blue.png";

        var markerClick = function (evt) {
            if (unsafeWindow.currentPopup)
                unsafeWindow.currentPopup.hide();

            if (this.popup == null) {
                this.popup = this.createPopup(true);
                map.addPopup(this.popup);
                this.popup.show();
            } else {
                this.popup.toggle();
            }
            unsafeWindow.currentPopup = this.popup;
            OpenLayers.Event.stop(evt);
        };
        marker.events.register("click", feature, markerClick);

    mylocationmarker.addMarker(marker);

    //marker.events.register('mousedown', marker, function(evt) { alert("Your location is marked in blue"); OpenLayers.Event.stop(evt); });
});

self.port.on('quakes', function(quakes)
{
    var map = unsafeWindow.map;
    var markers = unsafeWindow.markers;
    var OpenLayers = unsafeWindow.OpenLayers;

    if (!map)
        return;

    AutoSizeAnchoredBubble = OpenLayers.Class(OpenLayers.Popup.AnchoredBubble, {'autoSize': true});

    markers.clearMarkers();

    function addMarker(ll, popupClass, popupContentHTML, closeBox, overflow) {

        var feature = new OpenLayers.Feature(markers, ll); 
        feature.closeBox = closeBox;
        feature.popupClass = popupClass;
        feature.data.popupContentHTML = popupContentHTML;
        feature.data.overflow = (overflow) ? "auto" : "hidden";
                
        var marker = feature.createMarker();

        var markerClick = function (evt) {
            if (unsafeWindow.currentPopup)
                unsafeWindow.currentPopup.hide();

            if (this.popup == null) {
                this.popup = this.createPopup(this.closeBox);
                map.addPopup(this.popup);
                this.popup.show();
            } else {
                this.popup.toggle();
            }
            unsafeWindow.currentPopup = this.popup;
            OpenLayers.Event.stop(evt);
        };
        marker.events.register("click", feature, markerClick);

        markers.addMarker(marker);
    }

    for (var i=0;i<quakes.length;i++)
    {
        var point = new OpenLayers.LonLat(quakes[i].lng, quakes[i].lat);
        var popupClass = AutoSizeAnchoredBubble;
        var popupContentHTML = quakes[i].desc + "<br/>" + quakes[i].date;
        addMarker(point, popupClass, popupContentHTML, true);
    }
});
