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

/* global Image, webdb */

define(['map', 'file', 'utils'], function(map, file, utils){
    var SAVED_MAPS = 'saved-maps-v2';
    var MAX_CACHE = 52428800; // per download - 50 MB

    var maxDownloadStr = utils.bytesToSize(MAX_CACHE);
    var previews = {};
    var count = 0;
    var noOfTiles = 0;
    var imagesToDownloadQueue;
    var mapBase = utils.getMapSettings().baseLayer;

    /**
     * Single image download is complete.
     * @param url Remote Image URL.
     * @param value Local Image.
     */
    var downloadComplete = function(options){
        ++count;

        var percent = ((count / noOfTiles) * 100).toFixed(0);

        utils.inform(percent  + '%');
        if(count === noOfTiles){
            $.mobile.hidePageLoadingMsg();
        }

        var callback = function(){   //get the next image
            saveImageSynchronous(options.mapName);
        };

        if(options.url){
            webdb.insertCachedTilePath(options.x, options.y, options.z, options.tileData, options.mapName, callback);
        }
    };

    /**
     * Convert easting to TMS tile number.
     * @param eastings
     * @param zoom
     * @return Tile number.
     */
    var easting2tile = function(easting, zoom){
        var tn;
        var caps = map.getTileMapCapabilities();
        if(caps.tileFormat){
            tn = Math.floor(easting / (caps.tileFormat.width * caps.tileSet[zoom]));
        }

        return tn;
    };

    var getBoundsFromZoom = function(bounds, zoom){
        var xpoint2tile, ypoint2tile, txMin, txMax, tyMin, tyMax;
        if(mapBase == 'osm'){
            xpoint2tile = long2tile;
            ypoint2tile = lat2tile;
            var projections = map.getProjections(),
            tmpBounds = bounds.clone();
            tmpBounds.transform(projections[0], projections[1]);
            txMin = xpoint2tile(tmpBounds.left, zoom);
            txMax = xpoint2tile(tmpBounds.right, zoom);
            tyMax = ypoint2tile(tmpBounds.bottom, zoom);
            tyMin = ypoint2tile(tmpBounds.top, zoom);
        }else{
            xpoint2tile = easting2tile;
            ypoint2tile = northing2tile;
            txMin = xpoint2tile(bounds.left, zoom);
            txMax = xpoint2tile(bounds.right, zoom);
            tyMin = ypoint2tile(bounds.bottom, zoom);
            tyMax = ypoint2tile(bounds.top, zoom);
        }

        return {'txMin': txMin, 'txMax': txMax, 'tyMin': tyMin, 'tyMax': tyMax};
    };

    /**
     * Convert northing to TMS tile number.
     * @param northing
     * @param zoom
     * @return Tile number.
     */
    var northing2tile = function(northing, zoom){
        var tn;
        var caps = map.getTileMapCapabilities();
        if(caps.tileFormat){
            tn = Math.floor(northing / (caps.tileFormat.height * caps.tileSet[zoom]));
        }

        return tn;
    };

    /**
     * Convert longitude to TMS tile number.
     * @param lon
     * @param zoom
     * @return Tile number.
     */
    var long2tile = function(lon, zoom){
        return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
    };


    /**
     * Convert latitude to TMS tile number.
     * @param lat
     * @param zoom
     * @return Tile number.
     */
    var lat2tile = function(lat, zoom)  {
        return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
    };

    /**
     * Display preview of cached images.
     */
    var previewImages = function(){
        if(!$('#cache-slider').slider("option", "disabled")){
            var current = parseInt($("#cache-save-slider input").val());
            var next = current + 1;
            var previous = current - 1;

            $('#cache-preview').show();

            // TODO - needs to remove openlayers specific stuff
            var showMapPreview = function(options){
                var pMap;
                if(typeof(previews[options.name]) === 'undefined'){
                    pMap = new OpenLayers.Map(
                        options.div,
                        map.getOptions()
                    );

                    var layer, baseLaser = map.getBaseLayer();
                    if(baseLaser instanceof OpenLayers.Layer.OSM){
                        layer = new OpenLayers.Layer.OSM();
                    }else{
                        layer = new OpenLayers.Layer.TMS(
                        "os",
                        baseLaser.url,
                        {
                            layername: baseLaser.layername,
                            type: baseLaser.type
                        }
                    );
                    }

                    pMap.addLayer(layer);
                    previews[options.name] = pMap;
                }
                else{
                    pMap = previews[options.name];
                }

                pMap.zoomTo(options.zoom);
                pMap.setCenter(map.getCentre());

                return pMap;
            };

            // draw individual preview window
            var drawPreview = function(divId, zoom){
                $('#' + divId).show();

                var map = showMapPreview({
                    name: divId,
                    div: divId,
                    zoom: zoom,
                });

                if($('#' + divId + '.olMap').length === 0){
                    map.render(divId);
                }
            };

            var zooms = map.getZoomLevels();
            var zoom = parseInt($('#cache-slider').val());
            if(previous >= 0 && previous >= zooms.current){
                // draw left panel
                drawPreview('cache-preview-left', zoom - 1);
            }
            else{
                $('#cache-preview-left').hide();
            }

            // draw centre panel
            drawPreview('cache-preview-centre', zoom);

            if(next <= zooms.max){
                // draw right panel
                drawPreview('cache-preview-right',  zoom + 1);
            }
            else{
                $('#cache-preview-right').hide();
            }

            $('#save-map-map').css('opacity', '0.0');
            $('.map-zoom-buttons').hide();
        }
    };

    /**
     * Save images synchronously
     */
    var saveImageSynchronous = function(mapName){
        if(imagesToDownloadQueue.length !== 0){
            var imageInfo = imagesToDownloadQueue.pop();
            if(imageInfo){
                _this.saveImage({'url': imageInfo.url,
                                'z': imageInfo.zoom,
                                'x': imageInfo.tx,
                                'y': imageInfo.ty,
                                'type': imageInfo.type,
                                'mapName': mapName});
            }
        }
    };

    /**
     * Save current saved maps to localstorage.
     * @param maps Dictionary of maps.
     */
    var setSavedMap = function(maps){
        localStorage.setItem(SAVED_MAPS, JSON.stringify(maps));
    };

    /**
     * Save the associated details of a saved map.
     * @param name Map name.
     * @param details The associated details.
     */
    var setSavedMapDetails = function(name, details){
        var maps = _this.getSavedMaps();
        if(!maps){
            maps = {};
        }

        maps[name] = details;

        setSavedMap(maps);
    };

var _base = {
    AV_TILE_SIZE: 16384, // in bytes 16 KB

    /**
     * Remove saved map details from local storage.
     * @param name Saved map name.
     */
    deleteSavedMapDetails: function(mapName){
        var maps = this.getSavedMaps();
        if(maps){
            utils.inform('Deleting Tiles');
            $.mobile.hidePageLoadingMsg();

            delete maps[mapName];
            setSavedMap(maps);
        }

        webdb.deleteMap(mapName);
    },

    /**
     * save tiles details in array
     * @param zoom
     * @param txMin
     * @param txMax
     * @param tyMin
     * @param tyMax
     * @param type
     */
    getAllImages: function(options){
        var baseUrl;
        if(mapBase == 'osm'){
            baseUrl = utils.getMapServerUrl();
        }else{
            baseUrl = map.getBaseMapFullURL();
        }
        for (var tx = options.txMin; tx <= options.txMax; tx++) {
            for (var ty = options.tyMin; ty <= options.tyMax; ty++) {
                var url = baseUrl + '/' + options.zoom + '/' + tx + '/' + ty  + '.' + options.type;

                var imageInfo = {
                    url: url,
                    zoom: options.zoom,
                    tx:tx,
                    ty:ty,
                    type:options.type
                };
                imagesToDownloadQueue.push(imageInfo);
            }
        }
    },

    /**
     * Get saved map details.
     * @param name The name of the saved map.
     * @return Saved map details object.
     */
    getSavedMapDetails: function(name){
        var mapDetails;
        var maps = this.getSavedMaps();
        if(maps){
            mapDetails = maps[name];
        }

        return mapDetails;
    },

    /**
     * Get list of saved maps.
     * @return Associative array of stored maps.
     */
    getSavedMaps: function(){
        var maps;
        var obj = localStorage.getItem(SAVED_MAPS);

        if(obj){
            try{
                maps = JSON.parse(obj);
            }
            catch(ReferenceError){
                console.error('Problem with:');
                console.error(SAVED_MAPS);
                localStorage.removeItem(SAVED_MAPS);
            }
        }

        return maps;
    },

    /**
     * @return Current number of saved maps.
     */
    getSavedMapsCount: function(){
        var count = 0;

        for(var i in this.getSavedMaps()){
            ++count;
        }

        return count;
    },

    /**
     * Preview cache map slider change.
     */
    previewImagesChange: function(){
        // only redraw if slider value has changed
        if(this.mouseDown && this.lastPreviewed !== $('#cache-slider').val()){
            previewImages();
            this.lastPreviewed = $('#cache-slider').val();
        }

        // always update number of zoom levels
        $('#cache-save-details-zoom-level-but').val(
            $('#cache-slider').val() - map.getZoomLevels().current + 1);
        this.setSaveStats(map.getZoomLevels().current, $('#cache-slider').val());
    },

    /**
     * Preview cache map mouse down.
     */
    previewImagesMouseDown: function(){
        this.mouseDown = true;
        previewImages();
        this.lastPreviewed = $('#cache-slider').val();
    },

    /**
     * Preview cache map mouse up.
     */
    previewImagesMouseUp: function(){
        this.mouseDown = false;
        $('#cache-preview').hide();
        $('#save-map-map').css('opacity', '1');
        $('.map-zoom-buttons').show();
        map.getBaseLayer().redraw();
    },

    /**
     * Save image to sd card.
     * @param url External Tile URL.
     * @param zoom Map zoom level.
     * @param tx Tile xcoord.
     * @param ty Tile ycoord.
     * @param type Image file type.
     */
    saveImage: function(options){
        // TODO - check if image has been previously downloaded
        var img = new Image();
        img.crossOrigin = "anonymous"; // no credentials flag. Same as img.crossOrigin='anonymous'
        img.src = options.url;

        img.onload = $.proxy(function(event){
            var canvas = document.createElement("canvas");
            canvas.width = 256;
            canvas.height = 256;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(event.target, 0, 0);

            options.url = $(event.target).attr('src');
            options.tileData = canvas.toDataURL();
            downloadComplete(options);
        }, this);
    },

    /**
     * Cache tile images.
     * @param name Saved map name.
     * @param min Start zoom level to cache.
     * @param max End zoom level to cache.
     */
    saveMap: function(mapName, min, max){
        mapName = utils.santiseForFilename(mapName);
        var success = true;

        if(this.totalNumberOfTilesToDownload(min, max) * this.AV_TILE_SIZE > MAX_CACHE){
            navigator.notification.alert('Download size too large');
            success = false;
        }
        else{
            var details = this.getSavedMapDetails(mapName);

            if(details === undefined){
                count = 0;
                var layer = map.getBaseLayer();

                var bounds = map.getExtent();
                noOfTiles = this.totalNumberOfTilesToDownload(min, max);

                utils.inform("Saving ...");

                // store cached map details
                details = {
                    'poi': {
                        'centre': map.getCentre(),
                        'zoom': map.getZoom()
                    },
                    'bounds': bounds,
                    'images': []
                };

                imagesToDownloadQueue = [];

                for(var zoom = min; zoom <= max; zoom++) {
                    var calcBounds = getBoundsFromZoom(bounds, zoom);
                    this.getAllImages({"zoom": zoom,
                                      "txMin": calcBounds.txMin,
                                      "txMax": calcBounds.txMax,
                                      "tyMin": calcBounds.tyMin,
                                      "tyMax": calcBounds.tyMax,
                                      "type": map.getTileFileType()});
                }

                var downloadImageThreads = 8;
                for(var i=0; i < downloadImageThreads; i++){
                    saveImageSynchronous(mapName);
                }

                setSavedMapDetails(mapName, details);
            }
            else{
                utils.inform(mapName + ' is already defined');
                success = false;
            }
        }

        return success;
    },

    /**
     * Update cache page stats.
     * @param min minimum zoom level
     * @param max maximum zoom level
     */
    setSaveStats: function(min, max){
        var count = this.totalNumberOfTilesToDownload(min, max);
        var downloadSize = count * this.AV_TILE_SIZE;

        $('#cache-save-details-text-stats').html(
            'Download Size: ' +
                utils.bytesToSize(downloadSize) +
                ' (max ' + maxDownloadStr + ')');

        // disable download button if download is too big
        if(downloadSize > MAX_CACHE){
            $('#cache-save-details-button-div a').addClass('ui-disabled');
        }
        else{
            $('#cache-save-details-button-div a').removeClass('ui-disabled');
        }
    },

    /**
     * Count number of tile to cache.
     * @param min Start zoom level.
     * @param max End zoom level.
     */
    totalNumberOfTilesToDownload: function(min, max){
        var totalTileToDownload = 0;
        var bounds = map.getExtent();

        if(bounds !== null){
            for (var zoom = min; zoom <= max; zoom++){
                var calcBounds = getBoundsFromZoom(bounds, zoom);
                var ntx = calcBounds.txMax - calcBounds.txMin + 1;
                var nty = calcBounds.tyMax - calcBounds.tyMin + 1;
                totalTileToDownload += Math.abs((ntx * nty));
            }
        }
        else{
            console.warn("Map has no bounds, can't calculate download size");
        }

        return totalTileToDownload;
    }
};

var _this = {};

/**
 * TODO
 */
var _fs = {

    init: function(callback){
        // create directory structure for caching
        // Changed to persistent cache for iphone3G issue with temp cache
        // http://community.phonegap.com/nitobi/topics/localfilesystem_persistent_and_ios_data_storage_guidelines
        file.getPersistentRoot($.proxy(function(dir){
            dir.getDirectory(
                "mapcache",
                {create: true, exclusive: false},
                $.proxy(function(cacheDir){
                    this.cacheDir = cacheDir;
                    this.preventGalleryScanning(cacheDir);
                }, this),
                function(){
                    navigator.notification.alert('Failed finding root directory. Caching will be disabled.');
                });
        }, this));
    },

    /**
     * Remove all cached tiles.
     */
    clearCache: function(callback){
        this.cacheDir.createReader().readEntries(
            $.proxy(function(entries){
                var fileRemove = function(file){
                    file.remove();
                };
                var fileError = function(error){
                    console.error('Failed to delete image:' + error);
                };
                for (var i = 0; i < entries.length; i++) {
                    this.cacheDir.getFile(entries[i].name,
                                          {create: false, exclusive: false},
                                          fileRemove,
                                          fileError);
                }
            }, this),
            function(error){
                navigator.notification.alert('Problem reading cache directory: ' + error);
            }
        );
    },

    /**
     * Remove saved map details from local storage.
     * @param name Saved map name.
     */
    deleteSavedMapDetails: function(mapName){
        var maps = this.getSavedMaps();

        // remove file:// from cachedir fullpath
        var path = this.cacheDir.fullPath;
        if(path.slice(0,7) === "file://"){
            path = path.substr(7);
        }

        var localMapDir = path + "/" + mapName + "/" ;
        var onGetDirectorySuccess = function(directory){
            var success = function (parent) {
                webdb.deleteMap(mapName);
            };

            var fail = function(error) {
                console.error("Remove Recursively Failed" + error.code);
            };

            directory.removeRecursively(success, fail);
        };

        var onGetDirectoryFail = function (error) {
            console.error("*********** problem getting map tiles dir *********");
            console.error(error.code);
        };

        this.cacheDir.getDirectory(
            localMapDir,
            {
                create: false,
                exclusive: false
            },
            onGetDirectorySuccess, onGetDirectoryFail
        );

        _base.deleteSavedMapDetails(mapName);
    },

    /**
     * Creating .Nomedia file in cache directory prevents gallery scanning
     * directory.
     */
    preventGalleryScanning: function(){
        this.cacheDir.getFile(
            ".Nomedia",
            {create: true, exclusive: false},
            function(parent){},
            function(error){
                console.error("Failed to create .Nomedia" + error.code);
            }
        );
    },

    /**
     * Save image to sd card.
     * @param url External Tile URL.
     * @param zoom Map zoom level.
     * @param tx Tile xcoord.
     * @param ty Tile ycoord.
     * @param mapName.
     */
    saveImage: function(options){
        var maxNumberOfFilesPerDir = 100;
        var fileName = map.getStackType() + '_' + options.z +
            '_' + options.x + '_' +  options.y + '.' + options.type;

        var subDirectory = Math.ceil(count / maxNumberOfFilesPerDir);

        // remove file:// from cachedir fullpath
        var path = file.getFilePath(this.cacheDir);
        //not sure if it's needed in cordova 3
        //if(path.slice(0,7) === "file://"){
        //    path = path.substr(7);
        //}

        var localFileName = path + "/" + options.mapName +  "/" + subDirectory + "/" + fileName;
        console.debug("download " + options.url);

        var fileTransfer = new FileTransfer();

        fileTransfer.download(
            options.url + utils.getLoggingParams(true),
            localFileName,
            function(entry){
                downloadComplete({'url': options.url,
                                 'tileData': localFileName,
                                 'x': options.x,
                                 'y': options.y,
                                 'z': options.z,
                                 'mapName': options.mapName});
            },
            function(error) {
                console.error("download error source " + error.source);
                console.error("download error target " + error.target);

                // error code 3? - check whitelist
                console.error("download error code: " + error.code);
                downloadComplete();
            }
        );
    }
};

var _ios = {
    preventGalleryScanning: function(){
        // do nothing on ios
    }
};

if(utils.isMobileDevice()){
    $.extend(_this, _base, _fs);

    if(utils.isIOSApp()){
        $.extend(_this, _ios);
    }

    _this.init();
}
else{
    _this = _base;
}

return _this;

});