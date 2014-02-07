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

define(['map', 'utils', './cache'], function(map, utils, cache){
    var MAX_NO_OF_SAVED_MAPS = 3;

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
        var maps = getSavedMaps();
        var selectedSavedMap;
        var count = 0;

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
        var displayOnMap = $.proxy(function(){
            var name = selectedSavedMap.find('h3').text();
            var details = cache.getSavedMapDetails(name);

            if(details){
                map.showSavedMap(details);
            }
        }, this);

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

        $('#saved-maps-list-popup-view').click($.proxy(function(event){
            // view selected
            $.mobile.changePage('map.html');
            displayOnMap();
        }, this));
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
            $.proxy(function(event){
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
            }, this));

        // press and hold on a saved map
        $('.saved-map-click').on(
            'taphold',
            $.proxy(function(event){
                selectedSavedMap = $(event.target).parents('li');
                $('#saved-maps-list-popup').popup('open', {positionTo: 'origin'});
                taphold = true;
            }, this));

        // make map list scrollable on touch screens
        utils.touchScroll('#saved-maps-list');

        $('#saved-maps-list-list').listview('refresh');

        // show first map on list
        selectedSavedMap = $('#saved-maps-list li:first');
        displayOnMap();

        map.display('saved-maps-map');
    };

    /**
     * TODO
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

        //this.map.updateSize();
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

    /**
     * Show saved map layer and centre on previously saved map.
     * @param details Saved map details.
     */
    var showSavedMap = function(details){
        map.showBBox(savedMapsLayer, details.bounds, details.poi);
    };

    $(document).on('pageshow', '#saved-maps-page',  offlineMapsPage);
    $(document).on('pageshow', '#save-map-page', saveMapPage);
});
