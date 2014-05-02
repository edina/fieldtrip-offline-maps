"use strict";

define(['map', 'utils', './cache'], function(map, utils, cache) {
    var MAP_NAME = "name-name";
    var run = function() {
        module("Offline Maps");

        if(utils.isMobileDevice() || utils.isChrome()){
            test("Delete Map", function(){
                expect( 2 );
                var success = true;
                cache.deleteSavedMapDetails(MAP_NAME);
                stop();
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
                        console.log("File " + fileEntry.fullPath + " exists!");
                        tileExists = true;
                    }
                    function fileDoesNotExist(){
                        console.log("file does not exist");
                    }
                    function getFSFail(evt) {
                        console.log(evt.target.error.code);
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

                        console.log(fileLocation);
                        checkIfFileExists(fileLocation);
                    }

                    webdb.getCachedTilePath(callback, null, 316,661, 8, 'dummyUrl');

                    setTimeout( function() {
                        var maps = ui.cache.getSavedMaps();
                        ok((maps[MAP_NAME]), "Map should  be in localStorage" );
                        ok(url.indexOf('edina/cache/name-name/1/open_8_316_661.jpg') !== -1, 'Tile Stored in correct directory');
                        ok(tileExists === true, "Actual tile stored in phone directory");

                        start();
                    } ,2000);
                },2000)
            });
        }
    }

    return {run: run}
});
