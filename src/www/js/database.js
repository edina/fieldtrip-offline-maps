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

// TODO migrate below to requirejs syntax

var webdb = {};

webdb.DATABASE_CREATED = "false";

define(function(){
    if(typeof(openDatabase) !== 'undefined'){
        if(!webdb.db){
            webdb.open();
        }
    }
    else{
        webdb = undefined;
    }

    return webdb;
});

/**
 * TODO
 */
webdb.open = function() {
    var dbSize = 10 * 1024 * 1024; // 10MB
    webdb.db = openDatabase("webDbCache", "1.0", "Cached Tiles", dbSize);
}

/**
 * TODO
 */
webdb.onError = function(tx, e) {
    console.warn("There has been an error: " + e.message);
}

/**
 * TODO
 */
webdb.onSuccess = function(tx, r) {
    localStorage.setItem(webdb.DATABASE_CREATED, "true");
}

/**
 * TODO
 */
webdb.createTablesIfRequired = function() {
    console.log("Creating DataBase Tables");
    var db = webdb.db;
    db.transaction(function(tx) {
        tx.executeSql("CREATE TABLE IF NOT EXISTS " +
                      "tiles(zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data TEXT, mapName TEXT)", [], webdb.onSuccess,
                      webdb.onError);

        tx.executeSql("CREATE UNIQUE INDEX  IF NOT EXISTS " +
                      " tile_index on tiles(zoom_level, tile_column, tile_row, mapName)", [], webdb.onSuccess,
                      webdb.onError);

    });
}

/**
 * TODO
 */
webdb.deleteMap = function(mapName, callback){

    var db = webdb.db;

    var success = function (tx, rs){

        if(callback){
            callback(true);
        }
    }
    var error = function (tx,e){
        console.log("error DELETING MAP");
        console.log(e);
    }
    db.transaction(function(tx) {
        console.log("Delete mapname  " + mapName);
        tx.executeSql("DELETE FROM tiles WHERE mapName=?",
                      [ mapName],
                      success,
                      error
                     );

    });
}

/**
 * TODO
 */
webdb.insertCachedTilePath = function(x, y, z, tileData, mapName, callback){
    var db = webdb.db;

    var success = function (tx, rs){

        if(callback){
            callback();
        }
    }
    var error = function (tx,e){
        console.log("error");
        console.log(e.message);
        if(callback){
            callback();
        }
    }
    db.transaction(function(tx) {
        // console.log(' [urlKey, tilepath, mapName]' + urlKey + ', ' + tilepath + ', ' + mapName);
        tx.executeSql("INSERT INTO tiles(zoom_level, tile_column, tile_row, tile_data, mapName) VALUES (?,?,?,?,?)",
                      [z, x, y, tileData, mapName],
                      success,
                      error
                     );

    });
}

/**
 * TODO
 */
function hexToBase64(str) {
    return window.btoa(String.fromCharCode.apply(null, str.replace(/\r|\n/g, "").replace(/([\da-fA-F]{2}) ?/g, "0x$1 ").replace(/ +$/, "").split(" ")));
}

/**
 * TODO
 */
webdb.getCachedTilePath = function(callback, scope, x, y, z, url ){

    var db = webdb.db;

    var resultsCallback = function(tx, rs) {


        if(callback) {
            if( rs.rows.length > 0 ) {
                var rowOutput  = rs.rows.item(0);
                callback.call(scope,rowOutput['tile_data']);

            } else {
                callback.call(scope, url);
            }
        }

    }
    db.transaction(function(tx) {

        tx.executeSql("SELECT tile_data FROM tiles where zoom_level=? AND tile_column=? AND tile_row=?", [z,x,y], resultsCallback,
            webdb.onError);
    });



}

/**
 * TODO
 */
webdb.saveCachedTile = function(actualUrl, storedUrl){
    var db = webdb.db;

    var id = webdb.getUrl();


    db.transaction(function(tx) {

        tx.executeSql("SELECT * FROM urls where url=?", [url], resultsCallback,
            webdb.onError);
    });

};
