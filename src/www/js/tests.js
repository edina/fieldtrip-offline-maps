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

/* global asyncTest, expect, ok, start, stop, test */

define(['map', 'ui', 'utils', './cache', 'tests/systests'], function(// jshint ignore:line
    map, ui, utils, cache, sts) {

return {

unit: {
    run: function() {
        module("Offline Maps");

        if(utils.isMobileDevice() || utils.isChrome()){
            asyncTest("Delete Map", function(){
                var MAP_NAME = "name-name";
                expect( 2 );
                var success = true;
                cache.deleteSavedMapDetails(MAP_NAME);
                //stop();
                setTimeout(function(){
                    ok(success, "Database Map Deleted");
                    //check local storage
                    var maps = cache.getSavedMaps() || {};
                    ok(!(maps[MAP_NAME]), "Map should not be in localStorage" );
                    start();
                }, 2000);
            });
        }

        if(utils.isMobileDevice()){
            test("Download North edinburgh test", function() {
                var MAP_NAME = "name-name";
                expect(3);
                var bounds = new OpenLayers.Bounds(
                    322499.99340785,
                    676321.01823658,
                    323715.99340785,
                    677925.01823658
                );

                //first map is container
                map.zoomToExtent(bounds);

                cache.saveMap(MAP_NAME, 8, 9);

                stop();
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

                    webdb.getCachedTilePath(callback, null, 316,661, 8, 'dummyUrl');

                    setTimeout( function() {
                        var maps = ui.cache.getSavedMaps();
                        ok((maps[MAP_NAME]), "Map should  be in localStorage" );
                        ok(url.indexOf('edina/cache/name-name/1/open_8_316_661.jpg') !== -1, 'Tile Stored in correct directory');
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
        module("Offline Maps");
        if(utils.isMobileDevice() || utils.isChrome()){
            asyncTest("Save Map", function(){
                var savedMaps = cache.getSavedMaps();

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

                sts.changePageByFile('save-map.html', '#save-map-page', function(){
                    ok(true, 'navigate to save map page');

                    sts.clickAndTest({
                        'id': '#save-map-buttons-ok',
                        'test': function(){
                            return $('#cache-controls').is(':visible');
                        },
                        'cb': function(success){
                            ok(success, 'Save button');
                            sts.clickAndTest({
                                'id': '#cache-save-details-button-div a',
                                'test': function(){
                                    return $.mobile.activePage[0].id === 'save-map-name-dialog';
                                },
                                'cb': function(success){
                                    ok(success, 'Map name dialog');
                                    sts.clickAndTest({
                                        'id': '#saved-map-name-dialog-btn',
                                        'delay': 2500,
                                        'poll': 1000,
                                        'test': function(){
                                            // test has passed when map count has been incremented
                                            return (mapCount + 1)  === cache.getSavedMapsCount();
                                        },
                                        'cb': function(success){
                                            ok(success, 'Save Map');
                                            start();
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
