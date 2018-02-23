'use strict';
define([
        'dojo/_base/declare',
        'underscore'
    ],
    function(declare, _) {

        var State = declare(null, {
            constructor: function(data) {
                this.savedState = _.defaults({}, data, {
                    region: data.region,
                });
            },

            getState: function() {
                return this.savedState;
            },

            setRegion: function(region) {
                console.log('setting region', region)
                return this.clone({
                    region: region
                });
            },

            getRegion: function() {
                console.log(this.savedState)
                return this.savedState.region;
            },

            // Return new State combined with `data`.
            clone: function(data) {
                return new State(_.assign({}, this.getState(), data));
            }
        });

        return State;
    }
);
