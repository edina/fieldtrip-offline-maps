/*
Copyright (c) 2015, EDINA
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice, this
  list of conditions and the following disclaimer in the documentation and/or
  other materials provided with the distribution.
* Neither the name of EDINA nor the names of its contributors may be used to
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

/* global asyncTest, expect, ok, start, stop, test */

define(['map', 'ui', 'utils', './cache', 'tests/systests'], function(// jshint ignore:line
    map, ui, utils, cache, sts) {

return {

unit: {
    run: function() {
        module("Offline Maps");

        if(utils.isMobileDevice() || utils.isChrome()){

            // Test map deletion
            asyncTest("Delete Map", function(){
                var MAP_NAME = "name-name";
                expect( 2 );
                var success = true;

                // Delete a map
                cache.deleteSavedMapDetails(MAP_NAME);
                //stop();
                setTimeout(function(){
                    ok(success, "Database Map Deleted");
                    //check local storage
                    var maps = cache.getSavedMaps() || {};

                    // Assert that map was deleted
                    ok(!(maps[MAP_NAME]), "Map should not be in localStorage" );
                    start();
                }, 2000);
            });
        }

        if(utils.isMobileDevice()){
            // Test map downloading
            test("Download North edinburgh test", function() {
                var MAP_NAME = "name-name";
                expect(3);
                var bounds = new OpenLayers.Bounds(
                    322499.99340785,
                    676321.01823658,
                    323715.99340785,
                    677925.01823658
                );

                // Zoom into north Edinburgh
                map.zoomToExtent(bounds);

                // Save the map in the cache
                cache.saveMap(MAP_NAME, 8, 9);

                stop();

                //Wait two seconds
                setTimeout(function(){
                    var url ='';
                    var tileExists = false;

                    function fileExists(fileEntry){
                        tileExists = true;
                    }
                    function fileDoesNotExist(){
                        console.debug("file does not exist");
                    }
                    function getFSFail(evt) {
                        console.debug(evt.target.error.code);
                    }

                    function checkIfFileExists(path){
                        window.requestFileSystem(
                            LocalFileSystem.PERSISTENT,
                            0,
                            function(fileSystem){
                                fileSystem.root.getFile(path, { create: false }, fileExists, fileDoesNotExist);
                            },
                            getFSFail); //of requestFileSystem
                    }

                    var callback = function(fileLocation){
                        url = fileLocation;

                        checkIfFileExists(fileLocation);
                    };

                    // Get the path for a tile inside of the bounds
                    webdb.getCachedTilePath(callback, null, 316,661, 8, 'dummyUrl');

                    setTimeout( function() {
                        var maps = ui.cache.getSavedMaps();
                        // Assert that the map was created
                        ok((maps[MAP_NAME]), "Map should  be in localStorage" );
                        // Assert that the tile has the right path
                        ok(url.indexOf('edina/cache/name-name/1/open_8_316_661.jpg') !== -1, 'Tile Stored in correct directory');
                        // Assert that the tile exists
                        ok(tileExists === true, "Actual tile stored in phone directory");

                        start();
                    }, 2000);
                }, 2000);
            });
        }
    }
},
sys:{
    run: function() {

        /*
            Feature: Offline Maps
                In order to use the maps without connection
                as a user
                I want to select and area in the map and download it
                And visualized it
                And if I don't need it anymore delete it
            Scenario: Download Map
                Given that the user is in the save-map page
                And the user clicks the download map button
                Then the user select a zoom level using a slider
                When the user clicks the save button
                Then a popup is displaying requesting the name of the map
                Then the user can customize the name
                When the user clicks the save button
                Then the map tiles are saved in the application cache
        */
        module("Offline Maps");
        if(utils.isMobileDevice() || utils.isChrome()){
            asyncTest("Save Map", function(){
                var savedMaps = cache.getSavedMaps();

                // Make space for one map
                if(savedMaps !== undefined){
                    if(cache.getSavedMapsCount() === 3){
                        // delete one of the maps
                        $.each(cache.getSavedMaps(), function(name, map){
                            console.debug("delete " + name);
                            cache.deleteSavedMapDetails(name);
                            return;
                        });
                    }
                }
                var mapCount = cache.getSavedMapsCount();

                // Change to the save-map page
                sts.changePageByFile('save-map.html', '#save-map-page', function(){
                    ok(true, 'navigate to save map page');

                    sts.tapAndTest({
                        'id': '#save-map-buttons-ok',
                        'test': function(){
                            // Assert that the zoom control is visible
                            return $('#cache-controls').is(':visible');
                        },
                        'cb': function(success){
                            ok(success, 'Save button');

                            // Click the save button
                            sts.clickAndTest({
                                'id': '#cache-save-details-button-div > a',
                                'delay': 1000,
                                'test': function(){
                                    // Assert that the dialog for customizing the map name is visible
                                    return $('#save-map-name-dialog').is(':visible');
                                },
                                'cb': function(success){
                                    ok(success, 'Map name dialog');

                                    // Customize the map name
                                    var mapName = 'test_' + $('#saved-map-name-dialog-text').val();
                                    $('#saved-map-name-dialog-text').val(mapName);

                                    // Tap the save button
                                    sts.tapAndTest({
                                        'id': '#saved-map-name-dialog-btn',
                                        'delay': 1000,
                                        'poll': 1000,
                                        'test': function(){
                                            // Assert that the map was saved
                                            for(var key in cache.getSavedMaps()){
                                                if(key === utils.santiseForFilename(mapName)){
                                                    return true;
                                                }
                                            }
                                            return false;
                                        },
                                        'cb': function(success){
                                            ok(success, 'Save Map');
                                            sts.complete();
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
            });
        }
    }
}

};

});
