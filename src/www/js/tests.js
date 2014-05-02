"use strict";
define(['./cache'], function(cache) {
    var run = function() {
        test('Offline Maps: do something.', function() {
            equal(2, 2, 'The return should be 2.');
        });
    };
    return {run: run}
});
