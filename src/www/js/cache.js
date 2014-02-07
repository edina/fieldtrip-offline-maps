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

define(['map', 'utils'], function(map, utils){
    var MAX_CACHE = 52428800; // per download - 50 MB

    var maxDownloadStr = utils.bytesToSize(MAX_CACHE);

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

        return tn
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

    // !!!!!!!!!!!!! TODO need to do this for mercator !!!!!!!!!!!!!

    /**
     * Count number of tile to cache.
     * @param min Start zoom level.
     * @param max End zoom level.
     */
    var totalNumberOfTilesToDownload = function(min, max){
        var totalTileToDownload = 0;

        var bounds = map.getExtent();
        if(bounds !== null){
            for (var zoom = min; zoom <= max; zoom++){
                var txMin = easting2tile(bounds.left, zoom);
                var txMax = easting2tile(bounds.right, zoom);

                var tyMin = northing2tile(bounds.bottom, zoom);
                var tyMax = northing2tile(bounds.top, zoom);

                var ntx = txMax - txMin + 1;
                var nty = tyMax - tyMin + 1;

                totalTileToDownload += Math.abs((ntx * nty));
            }
        }
        else{
            console.warn("Map has no bounds, can't calculate download size");
        }

        return totalTileToDownload;
    };

return{
    /**
     * Remove saved map details from local storage.
     * @param name Saved map name.
     */
    deleteSavedMapDetails: function(mapName){
        var maps = getSavedMaps();

        var getLocalMapDir = function(cacheDir, name){
            // remove file:// from cachedir fullpath

            var path = cacheDir.fullPath;
            if(path.slice(0,7) === "file://"){
                path = path.substr(7);
            }
            return path + "/"+ name + "/" ;
        };

        var localMapDir = getLocalMapDir(this.cacheDir, mapName);
        var onGetDirectorySuccess = function(directory){
            var success = function (parent) {
                webdb.deleteMap(mapName);
            }

            var fail = function(error) {
                console.error("Remove Recursively Failed" + error.code);

            }

            directory.removeRecursively(success, fail);
        }

        var onGetDirectoryFail = function (error) {
            console.error("*********** problem getting map tiles dir *********");
            console.error(error.code);
        }

        this.cacheDir.getDirectory(
            localMapDir,
            {
                create: false,
                exclusive: false
            },
            onGetDirectorySuccess, onGetDirectoryFail
        );

        if(maps){
            var todo = 0;
            $.mobile.loading('show' ,{text:'Deleting Tiles'});
            $.mobile.hidePageLoadingMsg();

            delete maps[mapName];
            this.setSavedMap(maps);
        }
    },

    /**
     * Preview cache map slider change.
     */
    // previewImagesChange = function(){
    //     // only redraw if slider value has changed
    //     if(this.mouseDown && this.lastPreviewed !== $('#cache-slider').val()){
    //         this.previewImages();
    //         this.lastPreviewed = $('#cache-slider').val();
    //     }

    //     // always update number of zoom levels
    //     $('#cache-save-details-zoom-level-but').val(
    //         $('#cache-slider').val() - this.map.getZoomLevels().current + 1);
    //     this.setSaveStats(this.map.getZoomLevels().current, $('#cache-slider').val());
    // },

    /**
     * Update cache page stats.
     * @param min minimum zoom level
     * @param max maximum zoom level
     */
    setSaveStats: function(min, max){
        var count = totalNumberOfTilesToDownload(min, max);
        var downloadSize = count * Cache.AV_TILE_SIZE;

        $('#cache-save-details-text-stats').html(
            'Download Size: ' +
                Utils.bytesToSize(downloadSize) +
                ' (max ' + this.maxDownloadStr + ')');

        // disable download button if download is too big
        if(downloadSize > Cache.MAX_CACHE){
            $('#cache-save-details-button-div a').addClass('ui-disabled');
        }
        else{
            $('#cache-save-details-button-div a').removeClass('ui-disabled');
        }
    },

}

});