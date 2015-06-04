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

define(['utils'], function(utils){

    var db;

    var DATABASE_CREATED = 'DATABASE_CREATED_FLAG';

    var onError = function(tx, e) {
        console.warn("There has been an error: " + e.message);
    };

    var onSuccess = function(tx, r) {
        localStorage.setItem(DATABASE_CREATED, "true");
    };



    var webdb = {
        open: function() {
            var dbSize = 10 * 1024 * 1024; // 10MB
            var databaseOpened;
            if(window.sqlitePlugin) {
                databaseOpened = window.sqlitePlugin.openDatabase("webDb", "1.0", "Cached Tiles", dbSize);
            } else {
                if(typeof(openDatabase) !== 'undefined'){
                    databaseOpened = openDatabase("webDbCache", "1.0", "Cached Tiles", dbSize);
                }
            }
            return databaseOpened;
        },

        createTablesIfRequired: function() {
                console.log("Creating DataBase Tables");

            db.transaction(function(tx) {
                    tx.executeSql("CREATE TABLE IF NOT EXISTS " +
                                  "tiles(zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data TEXT, mapName TEXT)", [], onSuccess,
                                  onError);

                    tx.executeSql("CREATE UNIQUE INDEX  IF NOT EXISTS " +
                                  " tile_index on tiles(zoom_level, tile_column, tile_row, mapName)", [], onSuccess,
                                  onError);

                });
        },

        deleteMap: function(mapName, callback){

            var success = function (tx, rs){

                if(callback){
                    callback(true);
                }
            };
            var error = function (tx,e){
                console.log("error DELETING MAP");
                console.log(e);
            };
            db.transaction(function(tx) {
                console.log("Delete mapname  " + mapName);
                tx.executeSql("DELETE FROM tiles WHERE mapName=?",
                              [ mapName],
                              success,
                              error
                             );

            });
        },

        insertCachedTilePath: function(x, y, z, tileData, mapName, callback){// jshint ignore:line

            var successAndCallback = function (tx, rs){

                if(callback){
                    callback();
                }
            };
            var errorAndCallback = function (tx,e){
                console.log("error");
                console.log(e.message);
                if(callback){
                    callback();
                }
            };
            db.transaction(function(tx) {

                tx.executeSql("INSERT INTO tiles(zoom_level, tile_column, tile_row, tile_data, mapName) VALUES (?,?,?,?,?)",
                              [z, x, y, tileData, mapName],
                              successAndCallback,
                              errorAndCallback
                             );

            });
        },

        getCachedTilePath: function(callback, scope, tile, url, externalStorageDir ){// jshint ignore:line

            var resultsCallback = function(tx, rs) {


                if(callback) {
                    if( rs.rows.length > 0 ) {
                        var rowOutput  = rs.rows.item(0);
                        var tileFileLocation = (externalStorageDir || '') + rowOutput.tile_data;// jshint ignore:line
                        callback.call(scope, tileFileLocation);

                    } else {
                        callback.call(scope, url);
                    }
                }

            };
            db.transaction(function(tx) {

                tx.executeSql("SELECT tile_data FROM tiles where zoom_level=? AND tile_column=? AND tile_row=?", [tile.z, tile.x, tile.y], resultsCallback,
                    onError);
            });



        }

    };

    if(utils.isMobileDevice()){
        if(!db){
            db = webdb.open();
        }
    }
    else{
        webdb = undefined;
    }

    return webdb;
});
