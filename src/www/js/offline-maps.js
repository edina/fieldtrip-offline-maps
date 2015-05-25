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

/* global Connection */

define(['map', 'utils', './cache', './database', 'file'], function(// jshint ignore:line
    map, utils, cache, webdb, file){
    var MAX_NO_OF_SAVED_MAPS = 3;
    var LOCAL_STORAGE_NATIVE_URL;

    if(utils.isMobileDevice()){
        file.getPersistentRoot(function(fs){ LOCAL_STORAGE_NATIVE_URL = fs.nativeURL + cache.MAP_CACHE_DIR + '/';});
    }

    /**
     * Sets up packaged map meta data from config file if present.
     */

    var setupPackageMapsMetadata = function(){
        var config = utils.getConfig();
        var savedMapsMeta = config.offlinemapmetadata;
        if(savedMapsMeta){
            localStorage.setItem('saved-maps-v2', savedMapsMeta);
        }
    };



    /**
     * Enable or disable que download button if the limit of saved maps
     * has been reached
     */
    var checkDownloadLimit = function(){
        if(cache.getSavedMapsCount() < MAX_NO_OF_SAVED_MAPS){
            $('#save-map-buttons-ok').removeClass('ui-disabled');
        }
        else{
            $('#save-map-buttons-ok').addClass('ui-disabled');

            setTimeout(function(){
                utils.inform('You have reached the maximum number of saved maps.');
            }, 1000);
        }
    };


    // display a saved map on main map
    var displaySavedMap = function(mapName){
        console.debug('Display: ' + mapName);
        var details = cache.getSavedMapDetails(mapName);
        if(details){
            map.showBBox({
                'layer': savedMapsLayer,
                'bounds': details.bounds,
                'poi': details.poi
            });
        }
    };

    //zoom to a saved map on the preview map page
    var zoomToSavedMap = function(mapName){
        console.debug('Display: ' + mapName);
        var details = cache.getSavedMapDetails(mapName);
        if(details){
            map.setCentre({
                'lon': details.poi.centre.lon,
                'lat': details.poi.centre.lat,
                'zoom': details.poi.zoom,
                'ext': true
            });
        }
    };

    /**
     * Map with local storage caching.
     * @params options:
     *   url - TMS URL
     */
    var getMapWithLocalStorage = function(url){
        var layer;
        if(url === undefined){
            url = utils.getMapSettings().url;
        }
        if(map.isBaseLayerTMS()){
            layer = new FGBMapWithLocalStorage({url: map.getTMSURL(url)});
        }
        else{
            layer = new OSMMapWithLocalStorage({
                url: url+'/${z}/${x}/${y}.png'
            });
        }

        return layer;
    };

    /**
     * check for cached areas and zoom to them
     */
    var gotToCachedAreas = function(){
        console.log('gps time out event got fired');
        var maps = cache.getSavedMaps();
        var count = 0;
        if(maps && $.mobile.activePage.attr('id') === 'annotate-preview-page'){
            if(Object.keys(maps).length === 1){
                $.each(maps, function(index, value){
                    zoomToSavedMap(index);
                });
            }
            else {
                // build saved maps list
                $('#preview-saved-maps-list-list').html('');
                $.each(maps, function(index, value){
                    /*jshint multistr: true */
                    $('#preview-saved-maps-list-list').append(
                         '<li><fieldset class="ui-grid-solo"> \
                         <div class="ui-block-a">\
                         <a href="#" class="cached-map-click">\
                         <h3>' + index + '</h3></a>\
                         </div>\
                         </fieldset>\
                         </li>').trigger('create');
                    count++;
                });
                $('#preview-map-cached-popup').popup('open');
                // click on a saved map
                $('.cached-map-click').off('tap');
                $('.cached-map-click').on(
                    'tap',
                    function(event){
                        var mapName = $(event.target).text();
                        zoomToSavedMap(mapName);
                    }
                );
            }
        }
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
            var tile = {x:data[2], y:data[3] , z:data[1]};
            webdb.getCachedTilePath( callback, scope, tile, url, LOCAL_STORAGE_NATIVE_URL);
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
            this.type = 'png';
            if (options.url === "undefined/${z}/${x}/${y}.png") {
                this.url = [
                    'http://a.tile.openstreetmap.org/${z}/${x}/${y}.png',
                    'http://b.tile.openstreetmap.org/${z}/${x}/${y}.png',
                    'http://c.tile.openstreetmap.org/${z}/${x}/${y}.png'
                ];
            }
            else{
                this.url = [
                    options.url,
                    options.url.replace("a.", "b."),
                    options.url.replace("a.", "c.")
                ];
            }

            OpenLayers.Layer.OSM.prototype.initialize.apply(
                this,
                []
            );
        },
        getURLasync: function(bounds, callback, scope) {
            var url = OpenLayers.Layer.OSM.prototype.getURL.apply(this, [bounds]);
            var urlData = OpenLayers.Layer.XYZ.prototype.getXYZ.apply(this, [bounds]);
            webdb.getCachedTilePath( callback, scope, urlData, url, LOCAL_STORAGE_NATIVE_URL);
        }
    });

    // create layer on map for showing saved map extent
    var savedMapsLayer = map.addLayer({
        id: 'savedMaps',
        style:{colour: 'red'},
        visible:false
    });

    var resetButtonsToHiddenState = function(){

        $('#saved-maps-list-list .ui-block-b, #saved-maps-list-list .ui-block-c' ).hide();
    };

    /**
     * Show saved maps screen.
     */
    var offlineMapsPage = function(){
        var maps = cache.getSavedMaps();
        var selectedSavedMap;
        var count = 0;

        map.display('saved-maps-map');

        if(maps){
            // build saved maps list
            $.each(maps, function(index, value){
                /*jshint multistr: true */
                $('#saved-maps-list-list').append(
                     '<li><fieldset class="ui-grid-b"> \
                     <div class="ui-block-a">\
                     <a href="#" class="saved-map-click">\
                     <h3>' + index + '</h3></a>\
                     </div>\
                     <div class="ui-block-b">\
                     <a href="#" class="saved-map-delete" data-role="button" data-icon="delete" data-iconpos="notext" data-theme="a"></a>\
                     </div>\
                     <div class="ui-block-c">\
                     <a href="#" class="saved-map-view" data-role="button" data-icon="arrow-r" data-iconpos="notext" data-theme="a"></a>\
                     </div>\
                     </fieldset>\
                     </li>').trigger('create');
                ++count;
            });
        }

        var updateDownloadMessage = function(){
            var count = cache.getSavedMapsCount();
            console.debug(count);
            var msg = '';
            if(count === 0){
                msg = '<p class="large-text">No saved maps - go to <a href="save-map.html">Download</a> to create saved maps</p>';
            }
            else if(count < MAX_NO_OF_SAVED_MAPS){
                msg = '<p class="large-text"><a href="save-map.html">Download more maps</a></p>';
            }else{
                msg = '<p class="large-text">You have reached the maximum number of saved maps.</p>';
            }
            $('#saved-maps-list-download-msg').html(msg);
        };
        updateDownloadMessage();


        $('#saved-maps-list-popup-view').click(function(event){
            // view selected

            var mapName = $('#saved-maps-list-popup-name').text();

            displaySavedMap(mapName);
        });

        $('.saved-map-delete').click(function(event){
            var mapName = selectedSavedMap.find('h3').text();
            $('#saved-maps-delete-popup-name').text(mapName);
            $('#saved-maps-delete-popup').popup('open');

        });

        $('.saved-map-view').click(function(event){
            $('body').pagecontainer('change', 'map.html');
        });


        $('#saved-maps-delete-popup-confirm').click($.proxy(function(event){
            // confirm map delete
            cache.deleteSavedMapDetails(selectedSavedMap.find('h3').text());
            map.removeAllFeatures(savedMapsLayer);
            $('#saved-maps-delete-popup').popup("close");
            updateDownloadMessage();
            $(selectedSavedMap).slideUp('slow');
        }, this));

        // click on a saved map
        $('.saved-map-click').on(
            'tap',
            function(event){
                selectedSavedMap = $(event.target).parents('li');
                resetButtonsToHiddenState();

                //show buttons
                var uiBlockA = $(event.target).parent().parent();
                // contains delete button
                var uiBlockB = uiBlockA.next();
                uiBlockB.show();
                // contains the view map button
                var uiBlockC = uiBlockB.next();
                uiBlockC.show();


                var mapName = $(event.target).text();
                displaySavedMap(mapName);
            }
        );

        // make map list scrollable on touch screens
        utils.touchScroll('#saved-maps-list');

        $('#saved-maps-list-list').listview('refresh');


    };

    /**
     * Save Map Name dialog.
     */
    var saveMapNamePage = function(){
        var dlSize = cache.totalNumberOfTilesToDownload(
            map.getZoomLevels().current,
            $('#saved-map-name-dialog-save-to').val()) * cache.AV_TILE_SIZE;

        var doSaveMap = $.proxy(function(event){
            $('#save-map-name-dialog').popup('close');
            $('#cache-controls').hide();
            cache.saveMap($('#saved-map-name-dialog-text').val(),
                                 map.getZoomLevels().current,
                                 $('#saved-map-name-dialog-save-to').val());
            checkDownloadLimit();
            $('#save-map-buttons').show();
        }, this);

        $('#save-map-name-dialog-info').html(
            '<p>' + $('#cache-save-details-text-stats').text() + '</p>');

        $('#saved-map-name-dialog-text').val(new Date().toLocaleString().substr(0, 24));
        $('#saved-map-name-dialog-save-to').val($("#cache-slider").val());


        $('#saved-map-name-dialog-btn').on('tap', doSaveMap);
        $(document).on('keyup', '#saved-map-name-dialog-text', function(event){
            if(event.keyCode == 13){
                doSaveMap();
            }
        });

        $('#saved-map-name-dialog-cancel-btn').on('tap', $.proxy(function(event){
            event.preventDefault();
            $('#save-map-name-dialog').popup('close');
        }, this));
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

        $('#save-map-buttons-ok').on("tap", function(e){
            $('#cache-controls').show();
            $('#save-map-buttons').hide();
            e.preventDefault();
        });

        // initialise slider values according to zoom level
        setSliderValues();

        map.registerZoom(function(){
            setSliderValues();
        }, this);

        $('#cache-save-details-zoom-level-but').val('1');

        checkDownloadLimit();

        // attach map to save-map-map div
        map.display('save-map-map');
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

    /* saved-maps-page events */
    $(document).on('pagecreate', '#saved-maps-page', offlineMapsPage);
    $(document).on('_pageshow', '#saved-maps-page', function(){
        map.updateSize();

        resetButtonsToHiddenState();
        // show first map on list
        var mapName = $('#saved-maps-list ul>li:first h3').text();
        displaySavedMap(mapName);

    });
    $(document).on('pageremove', '#saved-maps-page', function(){
        map.removeAllFeatures(savedMapsLayer);
    });

    /* save-map-page events */
    $(document).on('_pageshow', '#save-map-page', saveMapPage);
    $(document).on('popupbeforeposition', '#save-map-name-dialog', saveMapNamePage);

    // adding stylesheet to beginning of head
    $('head').prepend('<link rel="stylesheet" href="plugins/offline-maps/css/style.css" type="text/css" />');

    $(document).on('change', '#settings-mapserver-url', function(){
        map.switchBaseLayer(
            getMapWithLocalStorage(
                $('#settings-mapserver-url option:selected').val())
        );
    });

    // close save map popup
    $(document).on('vclick', '#cache-controls-close', function(){
        $('#cache-controls').hide();
        $('#save-map-buttons').show();
    });

    $(document).on(map.EVT_GPS_TIMEOUT, gotToCachedAreas);


    setupPackageMapsMetadata();


    map.switchBaseLayer(getMapWithLocalStorage(utils.getMapServerUrl()));
});
