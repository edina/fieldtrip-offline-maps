/*
Copyright (c) 2014, EDINA.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or
   other materials provided with the distribution.
3. All advertising materials mentioning features or use of this software must
   display the following acknowledgement: This product includes software
   developed by the EDINA.
4. Neither the name of the EDINA nor the names of its contributors may be used to
   endorse or promote products derived from this software without specific prior
   written permission.

THIS SOFTWARE IS PROVIDED BY EDINA ''AS IS'' AND ANY EXPRESS OR IMPLIED
WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
SHALL EDINA BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.
*/

"use strict";

define(['ui', 'map', 'utils', './cache', './database'], function(ui, map, utils, cache, webdb){
    var MAX_NO_OF_SAVED_MAPS = 3;

    /**
     * Map with local storage caching.
     * @params options:
     *   url - TMS URL
     */
    var getMapWithLocalStorage = function(url){
        var layer;
        if(map.isBaseLayerTMS()){
            layer = new FGBMapWithLocalStorage({url: map.getTMSURL(url)});
        }
        else{
            layer = new OSMMapWithLocalStorage({
                url: utils.getMapServerUrl()+'/${z}/${x}/${y}.png'
            });
        }

        return layer;
    };

    /**
     * FGB Map with local storage caching.
     * @params options:
     *   url - TMS URL
     */
    var FGBMapWithLocalStorage = OpenLayers.Class(OpenLayers.Layer.TMS, {
        initialize: function(options) {
            var baseLayer = map.getBaseLayer();
            this.serviceVersion = baseLayer.serviceVersion;
            this.layername = baseLayer.layername;
            this.type = baseLayer.type;

            // this boolean determines which overriden method is called getURLasync
            // or getURL. Using getURLasync was causing the application to freeze,
            // often getting a ANR
            this.async = typeof(webdb) !== 'undefined';

            this.isBaseLayer = true;
            OpenLayers.Layer.TMS.prototype.initialize.apply(
                this,
                [baseLayer.name, options.url, {}]
            );
        },
        getURLasync: function(bounds, callback, scope) {
            var url = OpenLayers.Layer.TMS.prototype.getURL.apply(this, [bounds]);
            var data = url.match(/\/(\d+)/g).join("").split("/");
            webdb.getCachedTilePath( callback, scope, data[2], data[3] , data[1], url);
        },
        getURL: function(bounds) {
            return OpenLayers.Layer.TMS.prototype.getURL.apply(this, [bounds]);
        },
    });

    /**
     * OSM Map with local storage caching.
     * @params options:
     *     url            - TMS URL
     */
    var OSMMapWithLocalStorage = OpenLayers.Class(OpenLayers.Layer.OSM, {
        initialize: function(options) {

            // this boolean determines which overriden method is called getURLasync
            // or getURL. Using getURLasync was causing the application to freeze,
            // often getting a ANR
            this.async = typeof(webdb) !== 'undefined';
            if (options.url === "undefined/${z}/${x}/${y}.png") {
                this.url = [
                    'http://a.tile.openstreetmap.org/${z}/${x}/${y}.png',
                    'http://b.tile.openstreetmap.org/${z}/${x}/${y}.png',
                    'http://c.tile.openstreetmap.org/${z}/${x}/${y}.png'
                    ];
            }else{
                this.url = [options.url]
            }

            OpenLayers.Layer.OSM.prototype.initialize.apply(
                this,
                []
            );
        },
        getURLasync: function(bounds, callback, scope) {
            var url = OpenLayers.Layer.OSM.prototype.getURL.apply(this, [bounds]);
            var urlData = OpenLayers.Layer.XYZ.prototype.getXYZ.apply(this, [bounds]);
            webdb.getCachedTilePath( callback, scope, urlData.x, urlData.y , urlData.z, url);
        }
    });

    // create layer on map for showing saved map extent
    var savedMapsLayer = map.addLayer({
        id: 'savedMaps',
        style:{colour: 'red'},
        visible:false
    });

    /**
     * Show saved maps screen.
     */
    var offlineMapsPage = function(){
        var maps = cache.getSavedMaps();
        var selectedSavedMap;
        var count = 0;

        ui.mapPage('saved-maps-map');

        if(maps){
            // build saved maps list
            $.each(maps, function(index, value){
                $('#saved-maps-list-list').append(
                    '<li><fieldset class="ui-grid-b"> \
                       <div class="ui-block-a">\
                         <a href="#" class="saved-map-click">\
                         <h3>' + index + '</h3></a>\
                       </div>\
                       <div class="ui-block-b">\
                       </div>\
                       <div class="ui-block-c">\
                       </div>\
                       </fieldset>\
                     </li>').trigger('create');
                ++count;
            });
        }

        if(count === 0){
            $('#saved-maps-list').html('<p class="large-text">No saved maps - go to <a href="save-map.html">Download</a> to create saved maps</p>');
        }
        else if(count < MAX_NO_OF_SAVED_MAPS){
            $('#saved-maps-list').append('<p class="large-text"><a href="save-map.html">Download more maps</a></p>');
        }

        // display a saved map on main map
        var displayOnMap = function(){
            var name = selectedSavedMap.find('h3').text();
            var details = cache.getSavedMapDetails(name);
            if(details){
                map.showBBox({
                    'layer': savedMapsLayer,
                    'bounds': details.bounds,
                    'poi': details.poi
                });
            }
        };

        // context menu popup
        $('#saved-maps-list-popup').bind({
            // populate popup with map name
            popupafteropen: $.proxy(function(event, ui) {
                selectedSavedMap.toBeDeleted = false;
                $('#saved-maps-list-popup [data-role="divider"]').text(
                    selectedSavedMap.find('h3').text());
            }, this),
            popupafterclose: $.proxy(function() {
                if(selectedSavedMap.toBeDeleted){
                    // this hack is in the documentation for chaining popups:
                    // http://jquerymobile.com/demos/1.2.0/docs/pages/popup/index.html
                    setTimeout( function(){
                        $('#saved-maps-delete-popup').popup('open');
                    }, 100);
                }
            }, this)
        });

        $('#saved-maps-list-popup-view').click(function(event){
            // view selected
            $.mobile.changePage('map.html');
            displayOnMap();
        });
        $('#saved-maps-list-popup-delete').click($.proxy(function(event){
            // delete selected
            selectedSavedMap.toBeDeleted = true;
            $('#saved-maps-list-popup').popup('close');
        }, this));
        $('#saved-maps-delete-popup').bind({
            // populate delete dialog with map name
            popupafteropen: $.proxy(function(event, ui) {
                $('#saved-maps-delete-popup-name').text(
                    selectedSavedMap.find('h3').text());
            }, this)
        });
        $('#saved-maps-delete-popup-confirm').click($.proxy(function(event){
            // confirm map delete
            cache.deleteSavedMapDetails(selectedSavedMap.find('h3').text());
            $('#saved-maps-delete-popup').popup("close");
            $(selectedSavedMap).slideUp('slow');
        }, this));

        // click on a saved map
        var taphold = false;
        $('.saved-map-click').on(
            'tap',
            function(event){
                if(!taphold){
                    selectedSavedMap = $(event.target).parents('li');
                    displayOnMap();
                }
                else{
                    // taphold has been lifted
                    taphold = false;

                    // prevent popup dialog closing
                    event.preventDefault();
                }
            }
        );

        // press and hold on a saved map
        $('.saved-map-click').on(
            'taphold',
            function(event){
                selectedSavedMap = $(event.target).parents('li');
                $('#saved-maps-list-popup').popup('open', {positionTo: 'origin'});
                taphold = true;
            }
        );

        // make map list scrollable on touch screens
        utils.touchScroll('#saved-maps-list');

        $('#saved-maps-list-list').listview('refresh');

        // show first map on list
        selectedSavedMap = $('#saved-maps-list li:first');
        displayOnMap();

        savedMapsLayer.setVisibility(true);
    };

    /**
     * Save Map Name dialog.
     */
    var saveMapNamePage = function(){
        var dlSize = cache.totalNumberOfTilesToDownload(
            map.getZoomLevels().current,
            $('#saved-map-name-dialog-save-to').val()) * cache.AV_TILE_SIZE;

        var saveMap = false;

        $('#save-map-name-dialog-info').html(
            '<p>' + $('#cache-save-details-text-stats').text() + '</p>');

        $('#saved-map-name-dialog-text').val(new Date().toLocaleString().substr(0, 24));
        $('#saved-map-name-dialog-save-to').val($("#cache-slider").val());
        $('#saved-map-name-dialog-btn').click($.proxy(function(){
            $('.ui-dialog').dialog('close');
            saveMap = true;
        }, this));

        // use pageremove on save map name screen otherwise attaching the
        // showPageLoadingMsg to the page is problematic
        $('#save-map-name-dialog').on(
            'pageremove',
            function(){
                if(saveMap){
                    console.log(utils.getMapSettings()['baseLayer'])
                    if(cache.saveMap($('#saved-map-name-dialog-text').val(),
                                     map.getZoomLevels().current,
                                     $('#saved-map-name-dialog-save-to').val(),
                                     utils.getMapSettings()['baseLayer'])){
                    }
                }
            }
        );
    };

    /**
     * Initialise save map page.
     */
    var saveMapPage = function(){
        $('#cache-slider').bind(
            'change',
            $.proxy(cache.previewImagesChange, cache));
        $('#cache-save-slider .ui-slider-handle').bind(
            'vmousedown',
            $.proxy(cache.previewImagesMouseDown, cache));
        $('#cache-save-slider .ui-slider-handle').bind(
            'vmouseup',
            $.proxy(cache.previewImagesMouseUp, cache));

        map.removeAllFeatures(savedMapsLayer);

        $('#cache-controls').hide();
        $('#cache-preview').hide();
        $('#save-map-buttons').show();

        map.hideAnnotateLayer();
        map.hideRecordsLayer();

        var connection = utils.getConnectionStatus();
        if(utils.isMobileApp &&
           (connection.val === Connection.UNKNOWN ||
            connection.val === Connection.CELL_2G ||
            connection.val === Connection.NONE)){
            console.debug('current connection: ' + connection.str);
            utils.inform("You will need a decent network connection to use this functionality.");
        }

        $('#save-map-buttons-ok').click(function(){
            $('#cache-controls').show();
            $('#save-map-buttons').hide();
        });

        // initialise slider values according to zoom level
        setSliderValues();

        map.registerZoom(this, function(){
            setSliderValues();
        });

        $('#cache-save-details-zoom-level-but').val('1');

        if(cache.getSavedMapsCount() < MAX_NO_OF_SAVED_MAPS){
            $('#save-map-buttons-ok').removeClass('ui-disabled');
        }
        else{
            $('#save-map-buttons-ok').addClass('ui-disabled');

            setTimeout(function(){
                utils.inform('You have reached the maximum number of saved maps.');
            }, 1000);
        }

        // attach map to save-map-map div
        ui.mapPage('save-map-map');
    };

    /**
     * Set cache slider values depending on map resolution.
     */
    var setSliderValues = function(){
        var zooms = map.getZoomLevels();

        if(zooms.current === zooms.max){
            $('#cache-slider').slider("disable");
        }
        else{
            $('#cache-slider').slider("enable");
        }

        $('#cache-slider').attr('min', zooms.current);
        $('#cache-slider').attr('max', zooms.max);
        $("#cache-save-slider input").val(zooms.current).slider("refresh");

        cache.setSaveStats(zooms.current, zooms.current);
    };

    if(typeof(webdb) !== 'undefined'){
        if(localStorage.getItem(webdb.DATABASE_CREATED) !== "true"){
            webdb.createTablesIfRequired();
        }
    }

    $(document).on('pageinit', '#saved-maps-page', offlineMapsPage);
    $(document).on('pageshow', '#saved-maps-page', function(){
        map.updateSize();
    });

    $(document).on('pageshow', '#save-map-page', saveMapPage);
    $(document).on('pageinit', '#save-map-name-dialog', saveMapNamePage);

    // adding stylesheet to beginning of head
    $('head').prepend('<link rel="stylesheet" href="plugins/offline-maps/css/style.css" type="text/css" />');

    $(document).on('change', '#settings-mapserver-url', function(){
        if(utils.isMobileDevice()){
            map.switchBaseLayer(
                getMapWithLocalStorage(
                    $('#settings-mapserver-url option:selected').val())
            );
        }
        else{
            utils.inform("Switching doesn't work on the desktop.");
        }
    });

    map.switchBaseLayer(getMapWithLocalStorage());
});
